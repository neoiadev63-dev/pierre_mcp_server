#!/usr/bin/env python3
"""Fetch live wellness data from Garmin Connect API and generate wellness_summary.json."""

import json
import os
import statistics
import sys
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timedelta, date
from pathlib import Path

try:
    import garth
except ImportError:
    print("ERROR: garth not installed. Run: pip install garth")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent
TOKEN_DIR = Path(os.environ.get("GARTH_HOME", str(SCRIPT_DIR / ".garth")))
OUTPUT_PATH = Path(os.environ.get("WELLNESS_OUTPUT_PATH", str(SCRIPT_DIR.parent / "frontend" / "public" / "data" / "wellness_summary.json")))
STRAVA_CACHE_PATH = SCRIPT_DIR / ".strava_activities_cache.json"
DAYS_HISTORY = 30

# Gemini config
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("PIERRE_LLM_DEFAULT_MODEL", "gemini-2.5-flash")

# Strava config
STRAVA_CLIENT_ID = os.environ.get("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET", "")
STRAVA_REFRESH_TOKEN = os.environ.get("STRAVA_REFRESH_TOKEN", "")

# Bosch Flow config
BOSCH_TOKEN_PATH = SCRIPT_DIR / ".bosch_flow_token.json"
BOSCH_FLOW_CLIENT_ID = "one-bike-app"
BOSCH_AUTH_URL = "https://p9.authz.bosch.com/auth/realms/obc/protocol/openid-connect"
BOSCH_ACTIVITY_URL = "https://obc-rider-activity.prod.connected-biking.cloud/v1/activity"


def ensure_auth():
    """Authenticate with Garmin Connect (reuse saved tokens or login fresh)."""
    if TOKEN_DIR.exists():
        try:
            garth.resume(str(TOKEN_DIR))
            # Test the session with an endpoint known to work
            garth.connectapi("/activitylist-service/activities/search/activities?start=0&limit=1")
            print("  Authenticated (saved session)")
            return True
        except Exception:
            print("  Saved session expired, re-authenticating...")

    email = os.environ.get("GARMIN_EMAIL", "")
    password = os.environ.get("GARMIN_PASSWORD", "")

    if not email or not password:
        print("ERROR: Set GARMIN_EMAIL and GARMIN_PASSWORD environment variables")
        print("  Add these to your .envrc:")
        print('  export GARMIN_EMAIL="your.email@example.com"')
        print('  export GARMIN_PASSWORD="your-password"')
        return False

    try:
        garth.login(email, password)
        garth.save(str(TOKEN_DIR))
        print("  Authenticated and tokens saved")
        return True
    except Exception as e:
        print(f"ERROR: Authentication failed: {e}")
        return False


def fetch_daily_summary(d: date) -> dict | None:
    """Fetch daily wellness summary for a given date."""
    date_str = d.strftime("%Y-%m-%d")
    try:
        data = garth.connectapi(f"/usersummary-service/usersummary/daily?calendarDate={date_str}")
        return data
    except Exception as e:
        print(f"    Warning: no daily data for {date_str}: {e}")
        return None


def fetch_sleep(d: date) -> dict | None:
    """Fetch sleep data for a given date."""
    date_str = d.strftime("%Y-%m-%d")
    try:
        data = garth.connectapi(f"/wellness-service/wellness/dailySleepData?nonSleepBufferMinutes=60&date={date_str}")
        return data
    except Exception:
        return None


def fetch_heart_rate_daily(d: date) -> dict | None:
    """Fetch heart rate timeline for a given date."""
    date_str = d.strftime("%Y-%m-%d")
    try:
        data = garth.connectapi(f"/wellness-service/wellness/dailyHeartRate/{date_str}")
        return data
    except Exception:
        return None


def fetch_body_battery_daily(d: date) -> list | None:
    """Fetch body battery timeline for a given date."""
    date_str = d.strftime("%Y-%m-%d")
    try:
        data = garth.connectapi(f"/wellness-service/wellness/bodyBattery/dates/{date_str}/{date_str}")
        return data
    except Exception:
        return None


def fetch_respiration_daily(d: date) -> dict | None:
    """Fetch respiration timeline for a given date."""
    date_str = d.strftime("%Y-%m-%d")
    try:
        data = garth.connectapi(f"/wellness-service/wellness/daily/respiration/{date_str}")
        return data
    except Exception:
        return None


def fetch_spo2_daily(d: date) -> dict | None:
    """Fetch SpO2 timeline for a given date."""
    date_str = d.strftime("%Y-%m-%d")
    try:
        data = garth.connectapi(f"/wellness-service/wellness/daily/spo2/{date_str}/{date_str}")
        return data
    except Exception:
        return None


def fetch_hrv_daily(d: date) -> dict | None:
    """Fetch HRV (Heart Rate Variability) data for a given date."""
    date_str = d.strftime("%Y-%m-%d")
    try:
        data = garth.connectapi(f"/hrv-service/hrv/{date_str}")
        return data
    except Exception:
        return None


def build_sleep_detail(sleep_raw: dict | None, **_kwargs) -> dict | None:
    """Build detailed sleep data for the latest night with timeline data.
    All detailed data comes directly from the sleep endpoint response."""
    if not sleep_raw or not sleep_raw.get("dailySleepDTO"):
        return None

    s = sleep_raw["dailySleepDTO"]
    sleep_start = s.get("sleepStartTimestampLocal") or s.get("sleepStartTimestampGMT")
    sleep_end = s.get("sleepEndTimestampLocal") or s.get("sleepEndTimestampGMT")

    if not sleep_start or not sleep_end:
        return None

    # Sleep levels (epoch-level sleep stages) - top level in response
    sleep_levels = []
    raw_levels = sleep_raw.get("sleepLevels") or []
    if not isinstance(raw_levels, list):
        raw_levels = []
    for lvl in raw_levels:
        start_ts = lvl.get("startGMT") or lvl.get("startLocal")
        end_ts = lvl.get("endGMT") or lvl.get("endLocal")
        activity = lvl.get("activityLevel", 0)
        if start_ts and end_ts:
            sleep_levels.append({
                "start": start_ts,
                "end": end_ts,
                "level": activity,  # 0=deep, 1=light, 2=awake
            })

    # Sleep movement (minute-by-minute activity levels) - top level
    sleep_movement = []
    raw_movement = sleep_raw.get("sleepMovement") or []
    if not isinstance(raw_movement, list):
        raw_movement = []
    for mv in raw_movement:
        start_ts = mv.get("startGMT") or mv.get("startLocal")
        end_ts = mv.get("endGMT") or mv.get("endLocal")
        activity = mv.get("activityLevel", 0)
        if start_ts and end_ts:
            sleep_movement.append({
                "start": start_ts,
                "end": end_ts,
                "level": activity,
            })

    # Heart rate during sleep - top level: sleepHeartRate
    hr_timeline = []
    raw_hr = sleep_raw.get("sleepHeartRate") or []
    if isinstance(raw_hr, list):
        for entry in raw_hr:
            if isinstance(entry, dict):
                ts = entry.get("startGMT")
                val = entry.get("value")
                if ts and val and val > 0:
                    hr_timeline.append({"epoch_ms": ts, "value": val})

    # Body battery during sleep - top level: sleepBodyBattery
    bb_timeline = []
    raw_bb = sleep_raw.get("sleepBodyBattery") or []
    if isinstance(raw_bb, list):
        for entry in raw_bb:
            if isinstance(entry, dict):
                ts = entry.get("startGMT")
                val = entry.get("value")
                if ts and val is not None:
                    bb_timeline.append({"epoch_ms": ts, "value": val})

    # Stress during sleep - top level: sleepStress
    stress_timeline = []
    raw_stress = sleep_raw.get("sleepStress") or []
    if isinstance(raw_stress, list):
        for entry in raw_stress:
            if isinstance(entry, dict):
                ts = entry.get("startGMT")
                val = entry.get("value")
                if ts and val is not None:
                    stress_timeline.append({"epoch_ms": ts, "value": val})

    # SpO2 during sleep - top level: wellnessEpochSPO2DataDTOList
    spo2_timeline = []
    raw_spo2 = sleep_raw.get("wellnessEpochSPO2DataDTOList") or []
    if isinstance(raw_spo2, list):
        for entry in raw_spo2:
            if isinstance(entry, dict):
                ts = entry.get("epochTimestamp")
                val = entry.get("spo2Reading")
                if ts and val and val > 0:
                    spo2_timeline.append({"timestamp": ts, "value": val})

    # Respiration during sleep - top level: wellnessEpochRespirationDataDTOList
    resp_timeline = []
    raw_resp = sleep_raw.get("wellnessEpochRespirationDataDTOList") or []
    if isinstance(raw_resp, list):
        for entry in raw_resp:
            if isinstance(entry, dict):
                ts = entry.get("startTimeGMT") or entry.get("epochTimestamp")
                val = entry.get("respirationValue")
                if ts and val and val > 0:
                    resp_timeline.append({"epoch_ms": ts if isinstance(ts, (int, float)) else 0, "value": val})

    # Restless moments - top level: sleepRestlessMoments
    restless_moments = []
    raw_restless = sleep_raw.get("sleepRestlessMoments") or []
    if isinstance(raw_restless, list):
        for entry in raw_restless:
            if isinstance(entry, dict):
                ts = entry.get("startGMT")
                if ts:
                    restless_moments.append({"epoch_ms": ts})

    # Metrics from dailySleepDTO
    resting_hr = s.get("restingHeartRate")
    lowest_spo2 = s.get("lowestSpO2Value")
    avg_stress = s.get("averageStress")
    lowest_resp = s.get("lowestRespirationValue")
    bb_change = s.get("bodyBatteryChange")
    restless_count = s.get("restlessMomentsCount") or len(restless_moments)

    return {
        "sleepStartLocal": sleep_start,
        "sleepEndLocal": sleep_end,
        "sleepLevels": sleep_levels,
        "sleepMovement": sleep_movement,
        "hrTimeline": hr_timeline,
        "spo2Timeline": spo2_timeline,
        "respTimeline": resp_timeline,
        "bbTimeline": bb_timeline,
        "stressTimeline": stress_timeline,
        "restlessMoments": restless_moments,
        "restlessCount": restless_count,
        "restingHr": resting_hr,
        "lowestSpo2": lowest_spo2,
        "avgStress": avg_stress,
        "lowestResp": lowest_resp,
        "bbChange": bb_change,
    }


def fetch_weight(start: date, end: date) -> list:
    """Fetch weight measurements with body composition for a date range."""
    all_entries = []
    try:
        data = garth.connectapi(
            "/weight-service/weight/dateRange",
            params={
                "startDate": start.strftime("%Y-%m-%d"),
                "endDate": end.strftime("%Y-%m-%d"),
            },
        )
        if isinstance(data, dict):
            all_entries = data.get("dailyWeightSummaries", data.get("dateWeightList", []))
        elif isinstance(data, list):
            all_entries = data
    except Exception as e:
        print(f"    Warning: weight fetch failed: {e}")
    return all_entries


def build_weight_history(raw_entries: list) -> dict:
    """Build structured weight history with body composition from raw Garmin weight data."""
    entries = []
    for w in raw_entries:
        weight_g = w.get("weight") or w.get("summaryWeight")
        if not weight_g or not isinstance(weight_g, (int, float)) or weight_g <= 0:
            continue

        weight_kg = round(weight_g / 1000, 1) if weight_g > 1000 else round(weight_g, 1)

        # Parse date/time from timestamp or calendarDate
        cal_date = w.get("calendarDate", "")
        timestamp = w.get("date")
        time_str = ""
        if timestamp and isinstance(timestamp, (int, float)):
            dt = datetime.utcfromtimestamp(timestamp / 1000)
            if not cal_date:
                cal_date = dt.strftime("%Y-%m-%d")
            time_str = dt.strftime("%H:%M")

        # Body composition fields (Index S2 provides these)
        body_fat = w.get("bodyFat")
        muscle_mass_g = w.get("muscleMass")
        bone_mass_g = w.get("boneMass")
        body_water = w.get("bodyWater")
        bmi = w.get("bmi")

        entry = {
            "date": cal_date,
            "time": time_str,
            "weight_kg": weight_kg,
            "bmi": round(bmi, 1) if bmi else None,
            "body_fat_pct": round(body_fat, 1) if body_fat else None,
            "muscle_mass_kg": round(muscle_mass_g / 1000, 1) if muscle_mass_g and muscle_mass_g > 100 else (round(muscle_mass_g, 1) if muscle_mass_g else None),
            "bone_mass_kg": round(bone_mass_g / 1000, 1) if bone_mass_g and bone_mass_g > 100 else (round(bone_mass_g, 1) if bone_mass_g else None),
            "body_water_pct": round(body_water, 1) if body_water else None,
            "source": w.get("sourceType", "UNKNOWN"),
        }
        entries.append(entry)

    # Sort by date+time
    entries.sort(key=lambda e: f"{e['date']}T{e['time']}")

    # Goal weight (try to fetch from user settings)
    goal_kg = None
    try:
        profile = garth.connectapi("/userprofile-service/usersocialprofile")
        goal_kg = profile.get("weightGoal")
        if goal_kg and goal_kg > 1000:
            goal_kg = round(goal_kg / 1000, 1)
    except Exception:
        goal_kg = 75.0  # Default from Garmin screenshot

    return {
        "entries": entries,
        "goal_kg": goal_kg,
        "latest": entries[-1] if entries else None,
    }


def fetch_vo2max() -> dict | None:
    """Fetch latest VO2max data."""
    try:
        data = garth.connectapi("/metrics-service/metrics/maxmet/latest")
        if data:
            return {
                "date": data.get("calendarDate", ""),
                "vo2max": data.get("generic", {}).get("vo2MaxPreciseValue", data.get("vo2MaxValue")),
                "maxMet": data.get("maxMet"),
            }
    except Exception:
        pass
    # Fallback: try alternative endpoint
    try:
        today_str = date.today().strftime("%Y-%m-%d")
        data = garth.connectapi(f"/metrics-service/metrics/maxmet/daily/{today_str}/{today_str}")
        if data and isinstance(data, list) and len(data) > 0:
            last = data[-1]
            return {
                "date": last.get("calendarDate", ""),
                "vo2max": last.get("vo2MaxPreciseValue", last.get("generic", {}).get("vo2MaxPreciseValue")),
                "maxMet": last.get("maxMet"),
            }
    except Exception as e:
        print(f"    Warning: VO2max fetch failed: {e}")
    return None


def fetch_fitness_age() -> dict | None:
    """Fetch fitness age data."""
    try:
        data = garth.connectapi("/fitnessage-service/fitnessage")
        if data:
            return {
                "chronologicalAge": data.get("chronologicalAge"),
                "fitnessAge": round(data.get("fitnessAge", 0), 1),
                "bodyFat": data.get("bodyFatPercentage"),
                "bmi": round(data.get("bmi", 0), 1),
                "rhr": data.get("restingHeartRate"),
            }
    except Exception as e:
        print(f"    Warning: fitness age fetch failed: {e}")
    return None


def _parse_activity(act: dict) -> dict | None:
    """Parse a single activity dict from Garmin API into our format."""
    try:
        start_local = act.get("startTimeLocal", "")
        date_str = start_local[:10] if len(start_local) >= 10 else ""
        time_str = start_local[11:16] if len(start_local) >= 16 else ""

        hr_zones = []
        zones_data = act.get("timeInHRZones") or []
        if isinstance(zones_data, list):
            for i, z in enumerate(zones_data):
                secs = z if isinstance(z, (int, float)) else z.get("seconds", 0)
                hr_zones.append({"zone": i, "seconds": round(secs)})
        if not hr_zones:
            for i in range(7):
                ms = act.get(f"hrTimeInZone_{i}", 0) or 0
                if ms > 0:
                    hr_zones.append({"zone": i, "seconds": round(ms / 1000)})
            if not hr_zones:
                hr_zones = [{"zone": i, "seconds": 0} for i in range(7)]

        distance_m = act.get("distance", 0) or 0
        duration_s = act.get("duration", 0) or 0
        moving_s = act.get("movingDuration", 0) or 0
        elapsed_s = act.get("elapsedDuration", 0) or 0
        avg_speed = act.get("averageSpeed", 0) or 0
        max_speed = act.get("maxSpeed", 0) or 0

        return {
            "activityId": act.get("activityId"),
            "name": act.get("activityName", ""),
            "activityType": act.get("activityType", {}).get("typeKey", "") if isinstance(act.get("activityType"), dict) else act.get("activityType", ""),
            "sportType": act.get("sportTypeDTO", {}).get("typeKey", "").upper() if isinstance(act.get("sportTypeDTO"), dict) else act.get("sportType", ""),
            "date": date_str,
            "startTimeLocal": time_str,
            "location": act.get("locationName"),
            "duration_s": round(duration_s),
            "moving_duration_s": round(moving_s),
            "elapsed_duration_s": round(elapsed_s),
            "distance_km": round(distance_m / 1000, 2),
            "avg_speed_kmh": round(avg_speed * 3.6, 1),
            "max_speed_kmh": round(max_speed * 3.6, 1),
            "elevation_gain_m": round(act.get("elevationGain", 0) or 0),
            "elevation_loss_m": round(act.get("elevationLoss", 0) or 0),
            "min_elevation_m": round(act.get("minElevation", 0) or 0),
            "max_elevation_m": round(act.get("maxElevation", 0) or 0),
            "avg_hr": act.get("averageHR"),
            "max_hr": act.get("maxHR"),
            "min_hr": act.get("minHR"),
            "hrZones": hr_zones,
            "calories": round(act.get("calories", 0) or 0),
            "calories_consumed": round(act["caloriesConsumed"]) if act.get("caloriesConsumed") else None,
            "aerobic_te": act.get("aerobicTrainingEffect"),
            "anaerobic_te": act.get("anaerobicTrainingEffect"),
            "training_load": round(act["activityTrainingLoad"], 1) if act.get("activityTrainingLoad") else None,
            "te_label": act.get("trainingEffectLabel"),
            "min_temp_c": act.get("minTemperature"),
            "max_temp_c": act.get("maxTemperature"),
            "avg_respiration": round(act["avgRespirationRate"], 1) if act.get("avgRespirationRate") else None,
            "min_respiration": round(act["minRespirationRate"], 1) if act.get("minRespirationRate") else None,
            "max_respiration": round(act["maxRespirationRate"], 1) if act.get("maxRespirationRate") else None,
            "water_estimated_ml": round(act["waterEstimated"]) if act.get("waterEstimated") else None,
            "water_consumed_ml": round(act["waterConsumed"]) if act.get("waterConsumed") else None,
            # Cadence (bike)
            "avg_cadence": round(act["averageBikingCadenceInRevPerMinute"], 1) if act.get("averageBikingCadenceInRevPerMinute") else None,
            "max_cadence": round(act["maxBikingCadenceInRevPerMinute"], 1) if act.get("maxBikingCadenceInRevPerMinute") else None,
            # Power
            "avg_power": round(act["avgPower"], 1) if act.get("avgPower") else None,
            "max_power": round(act["maxPower"], 1) if act.get("maxPower") else None,
            "norm_power": round(act["normPower"], 1) if act.get("normPower") else None,
            # Trail
            "grit": round(act["grit"], 1) if act.get("grit") else None,
            "avg_flow": round(act["avgFlow"], 1) if act.get("avgFlow") else None,
            "jump_count": act.get("jumpCount"),
            "moderate_minutes": act.get("moderateIntensityMinutes", 0) or 0,
            "vigorous_minutes": act.get("vigorousIntensityMinutes", 0) or 0,
            "startLatitude": act.get("startLatitude"),
            "startLongitude": act.get("startLongitude"),
        }
    except Exception:
        return None


def fetch_activity_history(limit: int = 50) -> list:
    """Fetch recent activity history from Garmin Connect API."""
    try:
        data = garth.connectapi(
            "/activitylist-service/activities/search/activities",
            params={"limit": limit, "start": 0},
        )
        if not data or not isinstance(data, list):
            return []
        results = []
        for act in data:
            parsed = _parse_activity(act)
            if parsed:
                results.append(parsed)
        return results
    except Exception as e:
        print(f"    Warning: activity history fetch failed: {e}")
        return []


def fetch_latest_activity() -> dict | None:
    """Fetch the most recent activity from Garmin Connect API."""
    try:
        data = garth.connectapi(
            "/activitylist-service/activities/search/activities",
            params={"limit": 1, "start": 0},
        )
        if not data or not isinstance(data, list) or len(data) == 0:
            return None

        act = data[0]

        # Parse start time
        start_local = act.get("startTimeLocal", "")
        date_str = start_local[:10] if len(start_local) >= 10 else ""
        time_str = start_local[11:16] if len(start_local) >= 16 else ""

        # HR zones - API returns them as list of dicts or similar structure
        hr_zones = []
        zones_data = act.get("timeInHRZones") or []
        if isinstance(zones_data, list):
            for i, z in enumerate(zones_data):
                secs = z if isinstance(z, (int, float)) else z.get("seconds", 0)
                hr_zones.append({"zone": i, "seconds": round(secs)})
        # Fallback: try hrTimeInZone_X keys (same format as export)
        if not hr_zones:
            for i in range(7):
                ms = act.get(f"hrTimeInZone_{i}", 0) or 0
                if ms > 0:
                    hr_zones.append({"zone": i, "seconds": round(ms / 1000)})
            if not hr_zones:
                hr_zones = [{"zone": i, "seconds": 0} for i in range(7)]

        # API returns distance in meters, speed in m/s, elevation in meters, duration in seconds
        distance_m = act.get("distance", 0) or 0
        duration_s = act.get("duration", 0) or 0
        moving_s = act.get("movingDuration", 0) or 0
        elapsed_s = act.get("elapsedDuration", 0) or 0
        avg_speed = act.get("averageSpeed", 0) or 0
        max_speed = act.get("maxSpeed", 0) or 0

        return {
            "activityId": act.get("activityId"),
            "name": act.get("activityName", ""),
            "activityType": act.get("activityType", {}).get("typeKey", "") if isinstance(act.get("activityType"), dict) else act.get("activityType", ""),
            "sportType": act.get("sportTypeDTO", {}).get("typeKey", "").upper() if isinstance(act.get("sportTypeDTO"), dict) else act.get("sportType", ""),
            "date": date_str,
            "startTimeLocal": time_str,
            "location": act.get("locationName"),
            # Duration (API: seconds)
            "duration_s": round(duration_s),
            "moving_duration_s": round(moving_s),
            "elapsed_duration_s": round(elapsed_s),
            # Distance (API: meters → km)
            "distance_km": round(distance_m / 1000, 2),
            # Speed (API: m/s → km/h)
            "avg_speed_kmh": round(avg_speed * 3.6, 1),
            "max_speed_kmh": round(max_speed * 3.6, 1),
            # Elevation (API: meters)
            "elevation_gain_m": round(act.get("elevationGain", 0) or 0),
            "elevation_loss_m": round(act.get("elevationLoss", 0) or 0),
            "min_elevation_m": round(act.get("minElevation", 0) or 0),
            "max_elevation_m": round(act.get("maxElevation", 0) or 0),
            # HR
            "avg_hr": act.get("averageHR"),
            "max_hr": act.get("maxHR"),
            "min_hr": act.get("minHR"),
            "hrZones": hr_zones,
            # Calories
            "calories": round(act.get("calories", 0) or 0),
            "calories_consumed": round(act["caloriesConsumed"]) if act.get("caloriesConsumed") else None,
            # Training Effect
            "aerobic_te": act.get("aerobicTrainingEffect"),
            "anaerobic_te": act.get("anaerobicTrainingEffect"),
            "training_load": round(act["activityTrainingLoad"], 1) if act.get("activityTrainingLoad") else None,
            "te_label": act.get("trainingEffectLabel"),
            # Température
            "min_temp_c": act.get("minTemperature"),
            "max_temp_c": act.get("maxTemperature"),
            # Respiration
            "avg_respiration": round(act["avgRespirationRate"], 1) if act.get("avgRespirationRate") else None,
            "min_respiration": round(act["minRespirationRate"], 1) if act.get("minRespirationRate") else None,
            "max_respiration": round(act["maxRespirationRate"], 1) if act.get("maxRespirationRate") else None,
            # Hydratation
            "water_estimated_ml": round(act["waterEstimated"]) if act.get("waterEstimated") else None,
            "water_consumed_ml": round(act["waterConsumed"]) if act.get("waterConsumed") else None,
            # Cadence (bike)
            "avg_cadence": round(act["averageBikingCadenceInRevPerMinute"], 1) if act.get("averageBikingCadenceInRevPerMinute") else None,
            "max_cadence": round(act["maxBikingCadenceInRevPerMinute"], 1) if act.get("maxBikingCadenceInRevPerMinute") else None,
            # Power
            "avg_power": round(act["avgPower"], 1) if act.get("avgPower") else None,
            "max_power": round(act["maxPower"], 1) if act.get("maxPower") else None,
            "norm_power": round(act["normPower"], 1) if act.get("normPower") else None,
            # Trail
            "grit": round(act["grit"], 1) if act.get("grit") else None,
            "avg_flow": round(act["avgFlow"], 1) if act.get("avgFlow") else None,
            "jump_count": act.get("jumpCount"),
            # Intensité
            "moderate_minutes": act.get("moderateIntensityMinutes", 0) or 0,
            "vigorous_minutes": act.get("vigorousIntensityMinutes", 0) or 0,
            # GPS
            "startLatitude": act.get("startLatitude"),
            "startLongitude": act.get("startLongitude"),
        }
    except Exception as e:
        print(f"    Warning: activity fetch failed: {e}")
        return None


def build_daily_entry(d: date, daily: dict, sleep: dict | None, hrv: dict | None = None) -> dict:
    """Build a daily wellness entry from Garmin API data."""
    date_str = d.strftime("%Y-%m-%d")

    # Body battery
    bb_start = daily.get("startingBodyBatteryInMillis") or daily.get("bodyBatteryMostRecentValue")
    bb_estimate = None
    if bb_start:
        bb_estimate = bb_start if isinstance(bb_start, int) and bb_start <= 100 else None

    # Stress
    stress_high = daily.get("highStressDuration", 0) or 0
    stress_medium = daily.get("mediumStressDuration", 0) or 0
    stress_low = daily.get("lowStressDuration", 0) or 0
    stress_rest = daily.get("restStressDuration", 0) or 0

    entry = {
        "date": date_str,
        "steps": {
            "count": daily.get("totalSteps", 0) or 0,
            "goal": daily.get("dailyStepGoal", 7500) or 7500,
            "distance_m": daily.get("totalDistanceMeters", 0) or 0,
        },
        "heartRate": {
            "resting": daily.get("restingHeartRate"),
            "min": daily.get("minHeartRate"),
            "max": daily.get("maxHeartRate"),
        },
        "calories": {
            "total": daily.get("totalKilocalories", 0) or 0,
            "active": daily.get("activeKilocalories", 0) or 0,
            "bmr": daily.get("bmrKilocalories", 0) or 0,
        },
        "stress": {
            "average": daily.get("averageStressLevel"),
            "max": daily.get("maxStressLevel"),
            "low_minutes": round(stress_low / 60) if stress_low else 0,
            "medium_minutes": round(stress_medium / 60) if stress_medium else 0,
            "high_minutes": round(stress_high / 60) if stress_high else 0,
            "rest_minutes": round(stress_rest / 60) if stress_rest else 0,
        },
        "intensityMinutes": {
            "moderate": daily.get("moderateIntensityMinutes", 0) or 0,
            "vigorous": daily.get("vigorousIntensityMinutes", 0) or 0,
            "goal": daily.get("intensityMinutesGoal", 150) or 150,
        },
        "bodyBattery": {
            "estimate": bb_estimate,
        },
        "floors": {
            "ascended_m": daily.get("floorsAscendedInMeters", 0) or 0,
            "descended_m": daily.get("floorsDescendedInMeters", 0) or 0,
        },
    }

    # Sleep
    if sleep and sleep.get("dailySleepDTO"):
        s = sleep["dailySleepDTO"]
        deep = s.get("deepSleepSeconds", 0) or 0
        light = s.get("lightSleepSeconds", 0) or 0
        rem = s.get("remSleepSeconds", 0) or 0
        awake = s.get("awakeSleepSeconds", 0) or 0
        scores = s.get("sleepScores", {}) or {}
        spo2 = s.get("spo2SleepSummary", {}) or {}

        # Extract overall score: can be scores.overall.value or scores.overallScore
        overall = scores.get("overall", {})
        overall_score = overall.get("value") if isinstance(overall, dict) else None
        if overall_score is None:
            overall_score = scores.get("overallScore") or scores.get("totalScore") or s.get("overallScore")

        # Extract quality from qualityScore or restlessness qualifier
        quality_score = scores.get("qualityScore")

        # Extract HRV data
        hrv_rmssd = None
        hrv_sdrr = None
        hrv_status = None
        if hrv:
            hrv_summary = hrv.get("hrvSummary") or {}
            hrv_rmssd = hrv_summary.get("lastNightAvg") or hrv_summary.get("lastNight5MinHigh")
            hrv_status = hrv_summary.get("status")  # BALANCED, LOW, UNBALANCED
            # Fallback: check weekly average if no nightly value
            if hrv_rmssd is None:
                hrv_rmssd = hrv_summary.get("weeklyAvg")

            # Compute SDRR (SD of RR intervals) from 5-min HRV readings
            # SDRR = standard deviation of the HRV values across the night
            hrv_readings = hrv.get("hrvReadings") or []
            reading_values = [r.get("hrvValue") for r in hrv_readings if r.get("hrvValue") is not None and r.get("hrvValue") > 0]
            if len(reading_values) >= 3:
                hrv_sdrr = statistics.stdev(reading_values)

        entry["sleep"] = {
            "score": overall_score,
            "quality": quality_score,
            "duration_seconds": deep + light + rem + awake,
            "deep_seconds": deep,
            "light_seconds": light,
            "rem_seconds": rem,
            "awake_seconds": awake,
            "recovery_score": scores.get("recoveryScore"),
            "restfulness_score": scores.get("restfulnessScore"),
            "spo2_avg": s.get("averageSpO2Value") or spo2.get("averageSPO2"),
            "hr_avg": s.get("averageSpO2HRSleep") or s.get("restingHeartRate") or spo2.get("averageHR"),
            "respiration_avg": s.get("averageRespirationValue") or s.get("averageRespiration"),
            "feedback": scores.get("feedback"),
            "hrv_rmssd": round(hrv_rmssd, 1) if hrv_rmssd is not None else None,
            "hrv_sdrr": round(hrv_sdrr, 1) if hrv_sdrr is not None else None,
            "hrv_status": hrv_status,
        }
    else:
        entry["sleep"] = None

    return entry


def compute_weekly_intensity(days: list) -> dict:
    """Compute weekly intensity minutes total from the last 7 days."""
    last_7 = days[-7:] if len(days) >= 7 else days
    total_moderate = sum(d["intensityMinutes"]["moderate"] for d in last_7)
    total_vigorous = sum(d["intensityMinutes"]["vigorous"] for d in last_7)
    goal = last_7[-1]["intensityMinutes"]["goal"] if last_7 else 150
    return {
        "moderate": total_moderate,
        "vigorous": total_vigorous,
        "total": total_moderate + total_vigorous * 2,
        "goal": goal,
        "days": [
            {"date": d["date"], "moderate": d["intensityMinutes"]["moderate"], "vigorous": d["intensityMinutes"]["vigorous"]}
            for d in last_7
        ],
    }


def load_nutrition_data(date_str: str) -> dict | None:
    """Load nutrition data for a given date from the Docker volume."""
    # When running on VPS host, access Docker volume data
    data_base = os.environ.get("PIERRE_DATA_DIR", "/var/lib/docker/volumes/compose_pierre_data/_data")
    # Try user_id 1 (main user) - adjust if multi-user needed
    for user_id in ["1", "2"]:
        path = os.path.join(data_base, "nutrition", user_id, f"{date_str}.json")
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return None


def load_waist_data() -> list | None:
    """Load waist measurement history from the Docker volume."""
    data_base = os.environ.get("PIERRE_DATA_DIR", "/var/lib/docker/volumes/compose_pierre_data/_data")
    for user_id in ["1", "2"]:
        path = os.path.join(data_base, "waist", f"{user_id}.json")
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return None


def summarize_nutrition(meals_data: dict) -> str:
    """Create a concise nutrition summary for the coach prompt."""
    if not meals_data:
        return "Pas de données nutrition pour ce jour."

    total_cal = 0
    total_protein = 0
    total_carbs = 0
    total_fat = 0
    meal_summaries = []

    for meal_type in ["breakfast", "lunch", "dinner"]:
        items = meals_data.get(meal_type, [])
        if items:
            names = [item.get("name", "?") for item in items]
            meal_summaries.append(f"  {meal_type}: {', '.join(names)}")

    # Note: detailed calorie computation would require the nutrition DB
    # For now, provide the food list for the coach to interpret
    summary = f"Date: {meals_data.get('date', '?')}\n"
    if meal_summaries:
        summary += "Repas saisis:\n" + "\n".join(meal_summaries)
    else:
        summary += "Aucun repas saisi."

    return summary


def summarize_waist(waist_entries: list) -> str:
    """Create a concise waist measurement summary."""
    if not waist_entries:
        return "Pas de données tour de taille."

    latest = waist_entries[-1]
    summary = f"Dernière mesure: {latest.get('waist_cm')} cm ({latest.get('date', '?')})"

    if len(waist_entries) >= 2:
        prev = waist_entries[-2]
        delta = round(latest.get('waist_cm', 0) - prev.get('waist_cm', 0), 1)
        direction = "baisse" if delta < 0 else "hausse" if delta > 0 else "stable"
        summary += f"\nEvolution: {'+' if delta > 0 else ''}{delta} cm ({direction})"

    if len(waist_entries) >= 7:
        last_7 = waist_entries[-7:]
        values = [e.get('waist_cm', 0) for e in last_7]
        avg = round(sum(values) / len(values), 1)
        trend = round(values[-1] - values[0], 1)
        summary += f"\nTendance 7 dernières mesures: moyenne {avg} cm, variation {'+' if trend > 0 else ''}{trend} cm"

    return summary


def generate_coach_debriefing(today: dict, weekly: dict, fitness_age: dict | None, biometrics: dict | None, vo2max: dict | None, latest_activity: dict | None, weight_history: dict | None, days: list, activity_history: list | None = None) -> dict | None:
    """Call Gemini to generate a comprehensive coach debriefing."""
    if not GEMINI_API_KEY:
        print("  Warning: GEMINI_API_KEY not set, skipping coach debriefing")
        return None

    sleep = today.get("sleep") or {}
    stress = today.get("stress") or {}
    hr = today.get("heartRate") or {}
    steps = today.get("steps") or {}
    bb = today.get("bodyBattery") or {}
    cal = today.get("calories") or {}
    im = today.get("intensityMinutes") or {}

    age = fitness_age.get("chronologicalAge", 51) if fitness_age else 51
    fc_max = 220 - age
    fc_repos = hr.get("resting") or 44
    fc_reserve = fc_max - fc_repos
    z1_low = round(fc_repos + fc_reserve * 0.50)
    z1_high = round(fc_repos + fc_reserve * 0.60)
    z2_low = round(fc_repos + fc_reserve * 0.60)
    z2_high = round(fc_repos + fc_reserve * 0.70)
    z3_low = round(fc_repos + fc_reserve * 0.70)
    z3_high = round(fc_repos + fc_reserve * 0.80)
    z4_low = round(fc_repos + fc_reserve * 0.80)
    z4_high = round(fc_repos + fc_reserve * 0.90)

    weight = biometrics.get("weight_kg", 83.6) if biometrics else 83.6

    # Weight trend from last 7 days
    weight_trend = ""
    if weight_history and weight_history.get("entries"):
        recent = weight_history["entries"][-7:]
        weight_trend = ", ".join(f"{e['date']}: {e['weight_kg']}kg" for e in recent)

    # Latest activity summary
    activity_text = "Aucune activité récente."
    if latest_activity:
        act = latest_activity
        hr_zones_text = ", ".join(f"Z{z['zone']}={round(z['seconds']/60)}min" for z in act.get("hrZones", []) if z['seconds'] > 0)
        activity_text = f"""Dernière activité : {act.get('name', '?')} ({act.get('date', '?')})
- Distance : {act.get('distance_km', 0)} km, Durée : {round(act.get('duration_s', 0)/60)} min
- D+ : {act.get('elevation_gain_m', 0)} m
- FC moy : {act.get('avg_hr', '?')} bpm, FC max : {act.get('max_hr', '?')} bpm
- Zones FC : {hr_zones_text}
- TE aérobie : {act.get('aerobic_te', '?')}, TE anaérobie : {act.get('anaerobic_te', '?')}
- Grit : {act.get('grit', '?')}, Flow : {act.get('avg_flow', '?')}
- Calories : {act.get('calories', 0)} kcal"""

    # Build activity history text for progression comparison
    history_text = "Pas d'historique d'activités disponible."
    if activity_history and len(activity_history) > 1:
        lines = []
        for a in activity_history:
            hr_info = f"FC moy {a.get('avg_hr', '?')} / max {a.get('max_hr', '?')} bpm" if a.get('avg_hr') else ""
            lines.append(f"- {a['date']} | {a.get('name', '?')} | {a.get('distance_km', 0)}km | {round(a.get('duration_s', 0)/60)}min | D+{a.get('elevation_gain_m', 0)}m | {hr_info} | {a.get('calories', 0)}kcal | TE {a.get('aerobic_te', '?')}")
        history_text = "\n".join(lines)

    # Load nutrition and waist data
    today_str = today.get("calendarDate", today.get("date", datetime.now().strftime("%Y-%m-%d")))
    nutrition_data = load_nutrition_data(today_str)
    waist_entries = load_waist_data()
    nutrition_summary = summarize_nutrition(nutrition_data) if nutrition_data else "Pas de repas saisi aujourd'hui."
    waist_summary = summarize_waist(waist_entries) if waist_entries else "Pas de mesure tour de taille."

    prompt = f"""Tu es Pierre, un coach sportif IA expert en VTT et perte de graisse.
Réalise un DEBRIEFING COMPLET et détaillé de l'état de l'athlète en analysant TOUTES les données.

## Profil athlète
- Homme, {age} ans, {weight} kg, objectif : PERTE DE GRAS
- Sport : VTT ÉLECTRIQUE (30.5 kg) utilisé SANS ASSISTANCE (moteur éteint)
  → Effort très intense : le vélo pèse le double d'un VTT normal
- FC repos : {fc_repos} bpm, FC max estimée : {fc_max} bpm
- VO2max : {vo2max.get('vo2max', '?') if vo2max else '?'} ml/kg/min
- Âge fitness : {fitness_age.get('fitnessAge', '?') if fitness_age else '?'} ans (chrono: {age})
- IMC : {fitness_age.get('bmi', '?') if fitness_age else '?'}, Masse grasse : {fitness_age.get('bodyFat', '?') if fitness_age else '?'}%

## Zones FC personnalisées (Karvonen)
- Z1 Récupération : {z1_low}-{z1_high} bpm
- Z2 Endurance fondamentale : {z2_low}-{z2_high} bpm (BRÛLAGE GRAS OPTIMAL)
- Z3 Tempo : {z3_low}-{z3_high} bpm
- Z4 Seuil : {z4_low}-{z4_high} bpm

## Dernière nuit ({today['date']})
- Score sommeil : {sleep.get('score', '?')}/100, Qualité : {sleep.get('quality', '?')}/100
- Durée totale : {round(sleep.get('duration_seconds', 0)/3600, 1)}h
- Sommeil profond : {round(sleep.get('deep_seconds', 0)/60)} min
- Sommeil léger : {round(sleep.get('light_seconds', 0)/60)} min
- REM : {round(sleep.get('rem_seconds', 0)/60)} min
- Éveils : {round(sleep.get('awake_seconds', 0)/60)} min
- Récupération : {sleep.get('recovery_score', '?')}/100
- SpO2 moyenne nuit : {sleep.get('spo2_avg', '?')}%
- FC moyenne nuit : {sleep.get('hr_avg', '?')} bpm
- Respiration moyenne : {sleep.get('respiration_avg', '?')} rpm
- VFC (RMSSD) nuit : {sleep.get('hrv_rmssd', '?')} ms, status : {sleep.get('hrv_status', '?')}

## {activity_text}

## Tendance poids (7 derniers jours)
{weight_trend if weight_trend else "Pas de données de poids récentes."}

## Stress & Body Battery
- Stress moyen : {stress.get('average', '?')}, Stress max : {stress.get('max', '?')}
- Repos : {stress.get('rest_minutes', 0)} min, Stress faible : {stress.get('low_minutes', 0)} min
- Stress moyen : {stress.get('medium_minutes', 0)} min, Stress élevé : {stress.get('high_minutes', 0)} min
- Body Battery estimé : {bb.get('estimate', '?')}/100

## Activité quotidienne
- Pas : {steps.get('count', 0)} (objectif : {steps.get('goal', 7500)})
- Distance : {round(steps.get('distance_m', 0)/1000, 1)} km
- Calories totales : {cal.get('total', 0)} kcal (actives : {cal.get('active', 0)}, BMR : {cal.get('bmr', 0)})
- Minutes intensives (jour) : modéré {im.get('moderate', 0)}, vigoureux {im.get('vigorous', 0)}
- Minutes intensives (semaine) : {weekly.get('total', 0)}/{weekly.get('goal', 150)} (modéré {weekly.get('moderate', 0)}, vigoureux {weekly.get('vigorous', 0)})
- FC : repos {hr.get('resting', '?')}, min {hr.get('min', '?')}, max {hr.get('max', '?')} bpm

## Historique des activités (pour analyse de progression)
{history_text}

--- NUTRITION ---
{nutrition_summary}

--- TOUR DE TAILLE ---
{waist_summary}

OBJECTIFS: Perte de poids, santé du foie. Analyse la nutrition en rapport avec l'activité physique et la dépense calorique.

IMPORTANT : L'athlète a eu une période active en octobre/novembre, puis un ARRÊT de presque 2.5 mois, puis une reprise récente. Compare les performances sur les mêmes parcours/distances entre ces périodes.

## Style d'analyse attendu
Tu dois produire une analyse de niveau COACH PROFESSIONNEL, pas un résumé de données.

### Pour l'analyse d'activité (activityAnalysis) :
- Compare CHAQUE métrique avec les sorties précédentes sur un parcours similaire (même distance ±2 km) : temps, vitesse moy, FC moy, Training Effect, % temps en Z4+
- Explique la PHYSIOLOGIE derrière les chiffres : si la FC est la même mais la vitesse est moindre, explique POURQUOI (perte de volume plasmatique, régression mitochondriale, désentraînement aérobie)
- Interprète le Training Effect : 2.0-2.9 = maintien, 3.0-3.9 = amélioration, 4.0-4.9 = très exigeant, 5.0 = ALERTE ROUGE effort trop soutenu
- Si TE ≥ 4.5 : ALERTE explicite, nombre de jours de repos obligatoires
- Analyse le temps passé en Zone 4+ : au-delà de 30% c'est un signal de surcharge
- Mentionne la fréquence respiratoire si élevée (>28 brpm = dette d'oxygène)

### Pour la comparaison de progression (progressComparison) :
- Fais un TABLEAU MENTAL comparatif entre les sorties oct/nov vs la reprise sur parcours similaires
- Cite les chiffres exacts : "Avant : 14.3 km/h à 143 bpm (TE 2.9). Reprise : 13.6 km/h à 141 bpm (TE 5.0)"
- Explique les mécanismes physiologiques du désentraînement (volume plasmatique, mitochondries, capacité oxydative)
- Quantifie la régression estimée en % de capacité aérobie
- Donne un horizon de récupération réaliste ("3-4 semaines pour retrouver le niveau de novembre")

### Pour le sommeil (sleepAnalysis) :
- Corrèle la qualité du sommeil avec la charge d'entraînement de la veille
- Si VFC (HRV) a chuté : explique que c'est la réponse du système nerveux à la surcharge
- Compare le score de récupération avec les jours précédents

### Pour les conseils (nextTraining, nutritionPlan, hydrationPlan) :
- Sois TRÈS CONCRET : "Pas de VTT avant mardi, zone 2 uniquement (125-140 bpm), 45 min max"
- Nutrition post-effort : aliments SPÉCIFIQUES (sardines pour Oméga-3, myrtilles pour antioxydants, flocons d'avoine + whey pour récupération musculaire)
- Hydratation : quantités EXACTES (1.5L dans les 2h post-effort, 250ml toutes les 20 min pendant l'effort)
- Si TE ≥ 4 : INTERDIS la prochaine sortie intense, impose 3-4 jours de repos complet

### Ton :
- Direct, empathique, jamais condescendant
- Utilise des analogies pour expliquer la physiologie : "Votre cœur fait le même effort mais les muscles ne suivent plus"
- Reconnaître la frustration du désentraînement : "C'est frustrant mais normal"
- Toujours terminer sur du positif : mémoire musculaire, progression rapide au retour

Réponds en JSON avec exactement cette structure :
{{
  "sleepAnalysis": "Analyse détaillée de la nuit corrélée avec la charge d'entraînement : qualité, phases, récupération vs jours précédents, impact sur performance du lendemain (5-7 phrases)",
  "activityAnalysis": "Analyse COMPARATIVE de la dernière activité : comparer avec les sorties similaires (distance, D+), citer les chiffres exacts (vitesse, FC, TE, % zones), expliquer la physiologie derrière les écarts, interpréter le Training Effect avec niveau d'alerte si nécessaire (8-12 phrases)",
  "weightAnalysis": "Analyse de la tendance poids avec trajectoire, impact de l'arrêt et de la reprise, objectif réaliste à court terme (4-5 phrases)",
  "fitnessAssessment": "Évaluation VO2max et âge fitness dans le contexte du désentraînement, estimation de la régression en %, horizon de récupération (4-5 phrases)",
  "stressRecovery": "Analyse stress/body battery corrélée avec la charge d'entraînement, interprétation VFC post-effort, recommandations concrètes de récupération avec durée (4-5 phrases)",
  "hydrationPlan": "Plan hydratation CONCRET avec quantités EXACTES en ml : avant effort (timing + quantité), pendant effort (fréquence + quantité + électrolytes), après effort (fenêtre de réhydratation + quantité). Adaptations selon météo/saison (5-6 phrases)",
  "nutritionPlan": "Plan nutrition CONCRET post-effort et quotidien : aliments SPÉCIFIQUES par nom (sardines, myrtilles, flocons d'avoine, whey...), timing des repas, macros cibles, déficit calorique adapté à l'effort réalisé, anti-inflammatoires naturels si effort intense (6-8 phrases)",
  "progressComparison": "Comparaison CHIFFRÉE entre oct/nov et reprise sur parcours similaires (citer les métriques exactes de chaque sortie), explication physiologique du désentraînement (volume plasmatique, mitochondries), quantification de la régression (% capacité aérobie), horizon de retour au niveau. Être honnête mais encourageant : la mémoire musculaire permettra un retour rapide (8-12 phrases)",
  "nutritionAnalysis": "Bilan calorique vs dépense, adéquation macros, suggestions pour demain. Si tour de taille disponible, corrélation avec l'évolution du poids.",
  "nextTraining": {{
    "recommended_date": "YYYY-MM-DD",
    "type": "sortie_vtt | sortie_vtt_legere | marche_active | repos",
    "duration_min": 60,
    "warmup": "Échauffement détaillé avec FC cible EXACTE en bpm et durée en minutes",
    "main_set": "Effort principal détaillé : FC cible en bpm, gestion des montées avec le VTT 30.5kg, quand marcher si FC trop haute, objectif de temps en zone 2",
    "cooldown": "Retour au calme : durée, FC cible en bpm, étirements recommandés",
    "hr_target_bpm": "{z2_low}-{z2_high} bpm",
    "rationale": "Justification physiologique de cette séance par rapport à l'état actuel, le TE de la dernière sortie, et le niveau de récupération. Si repos : expliquer pourquoi c'est OBLIGATOIRE (4-5 phrases)"
  }}
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
        },
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        debriefing = json.loads(text)
        debriefing["generated_at"] = datetime.now().isoformat()
        return debriefing
    except Exception as e:
        print(f"    Warning: Gemini debriefing call failed: {e}")
        return None


def generate_coach_bilan(today: dict, weekly: dict, fitness_age: dict | None, biometrics: dict | None, vo2max: dict | None) -> dict | None:
    """Call Gemini to generate a personalized coach bilan."""
    if not GEMINI_API_KEY:
        print("  Warning: GEMINI_API_KEY not set, skipping coach bilan")
        return None

    sleep = today.get("sleep") or {}
    stress = today.get("stress") or {}
    hr = today.get("heartRate") or {}
    steps = today.get("steps") or {}
    bb = today.get("bodyBattery") or {}
    cal = today.get("calories") or {}

    age = fitness_age.get("chronologicalAge", 51) if fitness_age else 51
    fc_max = 220 - age
    fc_repos = hr.get("resting") or 44
    fc_reserve = fc_max - fc_repos
    z1_low = round(fc_repos + fc_reserve * 0.50)
    z1_high = round(fc_repos + fc_reserve * 0.60)
    z2_low = round(fc_repos + fc_reserve * 0.60)
    z2_high = round(fc_repos + fc_reserve * 0.70)
    z3_low = round(fc_repos + fc_reserve * 0.70)
    z3_high = round(fc_repos + fc_reserve * 0.80)
    z4_low = round(fc_repos + fc_reserve * 0.80)
    z4_high = round(fc_repos + fc_reserve * 0.90)

    weight = biometrics.get("weight_kg", 83.6) if biometrics else 83.6

    # Load nutrition and waist data
    today_str = today.get("calendarDate", today.get("date", datetime.now().strftime("%Y-%m-%d")))
    nutrition_data = load_nutrition_data(today_str)
    waist_entries = load_waist_data()
    nutrition_summary = summarize_nutrition(nutrition_data) if nutrition_data else "Pas de repas saisi aujourd'hui."
    waist_summary = summarize_waist(waist_entries) if waist_entries else "Pas de mesure tour de taille."

    prompt = f"""Tu es Pierre, un coach sportif IA spécialisé en VTT et en perte de graisse.
Analyse les données wellness Garmin et génère un bilan personnalisé avec des conseils TRÈS CONCRETS.

## Profil athlète
- Homme, {age} ans, {weight} kg, objectif : PERTE DE GRAS
- Sport : VTT ÉLECTRIQUE (30.5 kg) utilisé SANS ASSISTANCE (moteur éteint)
  → C'est un effort intense : le vélo pèse le double d'un VTT normal
  → Les montées sont très exigeantes avec ce poids
- FC repos : {fc_repos} bpm, FC max estimée : {fc_max} bpm, VO2max : {vo2max.get('vo2max', 41) if vo2max else 41}

## Zones FC personnalisées (méthode Karvonen)
- Z1 Récupération : {z1_low}-{z1_high} bpm
- Z2 Endurance fondamentale : {z2_low}-{z2_high} bpm (ZONE OPTIMALE BRÛLAGE DE GRAS)
- Z3 Tempo : {z3_low}-{z3_high} bpm
- Z4 Seuil : {z4_low}-{z4_high} bpm

## Données du jour ({today['date']})
- Sommeil : score {sleep.get('score', '?')}/100, durée {round(sleep.get('duration_seconds', 0)/3600, 1)}h, profond {round(sleep.get('deep_seconds', 0)/60)}min, REM {round(sleep.get('rem_seconds', 0)/60)}min
- VFC (RMSSD) nuit : {sleep.get('hrv_rmssd', '?')} ms, status : {sleep.get('hrv_status', '?')}
- Body Battery : {bb.get('estimate', '?')}/100
- Stress moyen : {stress.get('average', '?')}, repos {stress.get('rest_minutes', 0)}min
- Pas : {steps.get('count', 0)}, Calories : {cal.get('total', 0)} kcal
- Minutes intensives semaine : {weekly.get('total', 0)}/{weekly.get('goal', 150)}
- FC : repos {hr.get('resting', '?')}, min {hr.get('min', '?')}, max {hr.get('max', '?')}

--- NUTRITION DU JOUR ---
{nutrition_summary}

--- TOUR DE TAILLE ---
{waist_summary}

OBJECTIFS RAPPEL: Perte de poids progressive, santé du foie (réduction graisse viscérale).
Pour les conseils nutrition, donne des SUGGESTIONS GÉNÉRALES sur les repas restants de la journée (pas de recettes précises). Tiens compte de ce qui a déjà été mangé.

Réponds en JSON avec exactement cette structure (pas de markdown, juste le JSON) :
{{
  "nightSummary": "2-3 phrases sur la qualité du sommeil",
  "fitnessStatus": "2-3 phrases sur l'état de forme du jour",
  "trainingRecommendation": {{
    "type": "repos | sortie_vtt | marche_active | sortie_vtt_legere",
    "summary": "1 phrase résumant la recommandation",
    "duration_min": 0,
    "intensity": "légère | modérée | soutenue",
    "hr_zone": "Z2 Endurance",
    "hr_target_bpm": "{z2_low}-{z2_high} bpm",
    "details": "3-4 phrases CONCRÈTES",
    "warmup": "Consigne échauffement",
    "main_effort": "Description effort principal avec FC cible en bpm",
    "cooldown": "Consigne retour au calme"
  }},
  "hydration": "Conseils hydratation",
  "nutrition": "Conseils nutrition perte de gras"
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048, "responseMimeType": "application/json"},
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        bilan = json.loads(text)
        bilan["generated_at"] = datetime.now().isoformat()
        return bilan
    except Exception as e:
        print(f"    Warning: Gemini call failed: {e}")
        return None


# ── Strava Activity History ──────────────────────────────────────────────────

def _refresh_strava_token() -> str | None:
    """Refresh Strava access token using the refresh token."""
    payload = json.dumps({
        "client_id": STRAVA_CLIENT_ID,
        "client_secret": STRAVA_CLIENT_SECRET,
        "refresh_token": STRAVA_REFRESH_TOKEN,
        "grant_type": "refresh_token",
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://www.strava.com/oauth/token",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result.get("access_token")
    except Exception as e:
        print(f"    Strava token refresh failed: {e}")
        return None


def _parse_strava_activity(act: dict) -> dict:
    """Convert a Strava API activity to our ActivitySummary format."""
    sport = act.get("sport_type", act.get("type", "Ride"))
    distance_km = round((act.get("distance", 0) or 0) / 1000, 2)
    duration_s = act.get("moving_time", 0) or 0
    elapsed_s = act.get("elapsed_time", 0) or 0
    avg_speed = round((act.get("average_speed", 0) or 0) * 3.6, 1)  # m/s → km/h
    max_speed = round((act.get("max_speed", 0) or 0) * 3.6, 1)
    start_local = act.get("start_date_local", "")
    date_str = start_local[:10] if start_local else ""
    latlng = act.get("start_latlng") or [None, None]

    return {
        "activityId": act.get("id", 0),
        "source": "strava",
        "name": act.get("name", ""),
        "activityType": act.get("type", "Ride"),
        "sportType": sport,
        "date": date_str,
        "startTimeLocal": start_local,
        "location": None,
        "duration_s": duration_s,
        "moving_duration_s": duration_s,
        "elapsed_duration_s": elapsed_s,
        "distance_km": distance_km,
        "avg_speed_kmh": avg_speed,
        "max_speed_kmh": max_speed,
        "elevation_gain_m": round(act.get("total_elevation_gain", 0) or 0),
        "elevation_loss_m": round(act.get("total_elevation_gain", 0) or 0),  # Strava only gives gain
        "min_elevation_m": round(act.get("elev_low", 0) or 0),
        "max_elevation_m": round(act.get("elev_high", 0) or 0),
        "avg_hr": act.get("average_heartrate"),
        "max_hr": act.get("max_heartrate"),
        "min_hr": None,
        "hrZones": [],
        "calories": round(act.get("calories", 0) or 0),
        "calories_consumed": None,
        "aerobic_te": None,
        "anaerobic_te": None,
        "training_load": None,
        "te_label": None,
        "suffer_score": act.get("suffer_score"),
        "min_temp_c": None,
        "max_temp_c": None,
        "avg_respiration": None,
        "min_respiration": None,
        "max_respiration": None,
        "water_estimated_ml": None,
        "water_consumed_ml": None,
        # Cadence (Strava)
        "avg_cadence": round(act["average_cadence"], 1) if act.get("average_cadence") else None,
        "max_cadence": None,  # Strava doesn't provide max cadence in summary
        # Power (Strava)
        "avg_power": round(act["average_watts"], 1) if act.get("average_watts") else None,
        "max_power": round(act["max_watts"], 1) if act.get("max_watts") else None,
        "norm_power": round(act["weighted_average_watts"], 1) if act.get("weighted_average_watts") else None,
        # Trail
        "grit": None,
        "avg_flow": None,
        "jump_count": None,
        "moderate_minutes": 0,
        "vigorous_minutes": 0,
        "startLatitude": latlng[0] if latlng else None,
        "startLongitude": latlng[1] if len(latlng) > 1 else None,
    }


def fetch_strava_activities(max_pages: int = 5) -> list[dict]:
    """Fetch activity history from Strava API. Uses local cache (refreshed daily)."""
    # Check cache first (valid for 12 hours)
    if STRAVA_CACHE_PATH.exists():
        try:
            cache = json.loads(STRAVA_CACHE_PATH.read_text(encoding="utf-8"))
            cached_at = datetime.fromisoformat(cache["fetched_at"])
            age_hours = (datetime.now() - cached_at).total_seconds() / 3600
            if age_hours < 12:
                print(f"    Using Strava cache ({len(cache['activities'])} activities, {age_hours:.0f}h old)")
                return cache["activities"]
        except Exception:
            pass

    # Refresh token
    token = _refresh_strava_token()
    if not token:
        print("    Strava: no valid token, skipping")
        return []

    # Fetch activities (paginated, 200 per page)
    all_activities = []
    for page in range(1, max_pages + 1):
        url = f"https://www.strava.com/api/v3/athlete/activities?page={page}&per_page=200"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                activities = json.loads(resp.read().decode("utf-8"))
            if not activities:
                break
            for act in activities:
                parsed = _parse_strava_activity(act)
                if parsed["distance_km"] > 0:  # Skip zero-distance activities
                    all_activities.append(parsed)
            print(f"    Strava page {page}: {len(activities)} activities")
            if len(activities) < 200:
                break
        except Exception as e:
            print(f"    Strava fetch page {page} failed: {e}")
            break

    # Sort by date descending
    all_activities.sort(key=lambda a: a.get("startTimeLocal", ""), reverse=True)

    # Cache results
    if all_activities:
        cache = {"fetched_at": datetime.now().isoformat(), "activities": all_activities}
        STRAVA_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"    Strava: {len(all_activities)} activities cached")

    return all_activities


def merge_activity_histories(garmin: list[dict], strava: list[dict]) -> list[dict]:
    """Merge Garmin and Strava activities, deduplicate by date+distance similarity."""
    merged = list(garmin)
    garmin_dates = {}
    for act in garmin:
        key = act.get("date", "")
        if key not in garmin_dates:
            garmin_dates[key] = []
        garmin_dates[key].append(act)

    for s_act in strava:
        s_date = s_act.get("date", "")
        s_dist = s_act.get("distance_km", 0)
        # Check for duplicate: same date and similar distance (±2 km)
        is_dup = False
        if s_date in garmin_dates:
            for g_act in garmin_dates[s_date]:
                g_dist = g_act.get("distance_km", 0)
                if abs(g_dist - s_dist) < 2.0:
                    is_dup = True
                    break
        if not is_dup:
            merged.append(s_act)

    # Sort by date descending (use "date" field which is YYYY-MM-DD for both sources)
    # Then by startTimeLocal as secondary sort for same-day activities
    merged.sort(key=lambda a: (a.get("date", ""), a.get("startTimeLocal", "")), reverse=True)
    return merged


# ── Bosch Flow eBike Integration ─────────────────────────────────────────────

def _bosch_load_token() -> dict | None:
    """Load saved Bosch Flow OAuth token."""
    if not BOSCH_TOKEN_PATH.exists():
        return None
    try:
        data = json.loads(BOSCH_TOKEN_PATH.read_text(encoding="utf-8"))
        if data.get("refresh_token"):
            return data
    except Exception:
        pass
    return None


def _bosch_save_token(token_data: dict):
    """Save Bosch Flow OAuth token to disk."""
    token_data["saved_at"] = datetime.now().isoformat()
    BOSCH_TOKEN_PATH.write_text(json.dumps(token_data, indent=2), encoding="utf-8")


def _bosch_refresh_access_token(refresh_token: str) -> dict | None:
    """Refresh the Bosch Flow access token."""
    payload = urllib.parse.urlencode({
        "refresh_token": refresh_token,
        "client_id": BOSCH_FLOW_CLIENT_ID,
        "grant_type": "refresh_token",
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BOSCH_AUTH_URL}/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"    Bosch token refresh failed: {e}")
        return None


def bosch_initial_login(username: str, password: str) -> dict | None:
    """Perform initial Bosch Flow login using Connect API (username/password).
    This gets a token from the old eBike Connect API, then we can use it.
    For the Flow API, we need OAuth2 with PKCE - but we can use the Connect API
    as a simpler alternative that also provides ride data.
    """
    payload = json.dumps({
        "mobile_id": "PIERRE-COACH-APP",
        "password": password,
        "username": username,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://www.ebike-connect.com/ebikeconnect/api/app/token/public",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/vnd.ebike-connect.com.v4+json, application/json",
            "User-Agent": "Pierre/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        token_data = {
            "token_value": result.get("token_value"),
            "mobile_id": result.get("mobile_id", "PIERRE-COACH-APP"),
            "api_type": "connect",
        }
        _bosch_save_token(token_data)
        return token_data
    except Exception as e:
        print(f"    Bosch Connect login failed: {e}")
        return None


def bosch_save_flow_token(auth_code: str) -> dict | None:
    """Exchange a Bosch Flow OAuth authorization code for tokens.
    The user must get the auth code by opening:
    https://p9.authz.bosch.com/auth/realms/obc/protocol/openid-connect/auth
      ?client_id=one-bike-app&redirect_uri=onebikeapp-ios://com.bosch.ebike.onebikeapp/oauth2redirect
      &response_type=code&scope=openid
    Then extract the 'code' parameter from the redirect URL.
    """
    payload = urllib.parse.urlencode({
        "code": auth_code,
        "code_verifier": "u_QNKed3HzTrRyUmAuIOapRILsUFfbDWG5i_AwqRKaU",
        "redirect_uri": "onebikeapp-ios://com.bosch.ebike.onebikeapp/oauth2redirect",
        "client_id": BOSCH_FLOW_CLIENT_ID,
        "grant_type": "authorization_code",
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BOSCH_AUTH_URL}/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        token_data = {
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "api_type": "flow",
        }
        _bosch_save_token(token_data)
        return token_data
    except Exception as e:
        print(f"    Bosch Flow token exchange failed: {e}")
        return None


def _bosch_ensure_token() -> tuple[str, str] | None:
    """Ensure we have a valid Bosch token. Returns (token, api_type) or None."""
    token_data = _bosch_load_token()
    if not token_data:
        return None

    api_type = token_data.get("api_type", "connect")

    if api_type == "flow":
        # Try to refresh the Flow token
        refreshed = _bosch_refresh_access_token(token_data["refresh_token"])
        if refreshed:
            token_data["access_token"] = refreshed["access_token"]
            if refreshed.get("refresh_token"):
                token_data["refresh_token"] = refreshed["refresh_token"]
            _bosch_save_token(token_data)
            return (token_data["access_token"], "flow")
        return None
    elif api_type == "connect":
        return (f'{token_data["token_value"]}:{token_data["mobile_id"]}', "connect")

    return None


def _bosch_fetch_activities_flow(access_token: str, max_activities: int = 50) -> list[dict]:
    """Fetch activities from Bosch Flow API."""
    url = f"{BOSCH_ACTIVITY_URL}?page=0&size={max_activities}&sort=-startTime"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result.get("data", [])
    except Exception as e:
        print(f"    Bosch Flow activities fetch failed: {e}")
        return []


def _bosch_fetch_activity_detail_flow(access_token: str, activity_id: str) -> dict | None:
    """Fetch detailed activity data from Bosch Flow API."""
    url = f"{BOSCH_ACTIVITY_URL}/{activity_id}/detail"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result.get("data", {}).get("attributes", {})
    except Exception as e:
        print(f"    Bosch Flow detail fetch failed for {activity_id}: {e}")
        return None


def _bosch_fetch_activities_connect(auth_header: str, max_trips: int = 50) -> list[dict]:
    """Fetch trip headers from Bosch eBike Connect API."""
    url = f"https://www.ebike-connect.com/ebikeconnect/api/app/activities/trip/headers?max={max_trips}&offset=0"
    req = urllib.request.Request(
        url,
        headers={
            "x-authorization": auth_header,
            "Accept": "application/vnd.ebike-connect.com.v4+json, application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result if isinstance(result, list) else result.get("trips", result.get("data", []))
    except Exception as e:
        print(f"    Bosch Connect trips fetch failed: {e}")
        return []


def fetch_bosch_activities() -> list[dict]:
    """Fetch Bosch eBike activities and extract power/cadence data."""
    token_info = _bosch_ensure_token()
    if not token_info:
        return []

    token, api_type = token_info
    bosch_activities = []

    if api_type == "flow":
        raw = _bosch_fetch_activities_flow(token, 50)
        for act in raw:
            attrs = act.get("attributes", {})
            act_id = act.get("id", "")
            start_time = attrs.get("startTime", "")
            date_str = start_time[:10] if len(start_time) >= 10 else ""

            # Fetch detail for power/cadence
            detail = _bosch_fetch_activity_detail_flow(token, act_id)

            entry = {
                "date": date_str,
                "start_time": start_time,
                "duration_s": attrs.get("duration", 0),
                "distance_km": round((attrs.get("distance", 0) or 0) / 1000, 2),
                "avg_power": None,
                "max_power": None,
                "avg_cadence": None,
                "max_cadence": None,
                "avg_speed_kmh": None,
                "max_speed_kmh": None,
                "calories": None,
                "source": "bosch_flow",
            }

            if detail:
                entry["avg_power"] = detail.get("averagePower") or detail.get("avgPower") or detail.get("averageRiderPower")
                entry["max_power"] = detail.get("maxPower") or detail.get("maximumPower") or detail.get("maxRiderPower")
                entry["avg_cadence"] = detail.get("averageCadence") or detail.get("avgCadence")
                entry["max_cadence"] = detail.get("maxCadence") or detail.get("maximumCadence")
                entry["avg_speed_kmh"] = round((detail.get("averageSpeed", 0) or 0) * 3.6, 1) if detail.get("averageSpeed") else None
                entry["max_speed_kmh"] = round((detail.get("maxSpeed", 0) or 0) * 3.6, 1) if detail.get("maxSpeed") else None
                entry["calories"] = detail.get("calories") or detail.get("totalCalories")

            if entry["avg_power"] or entry["avg_cadence"]:
                bosch_activities.append(entry)

    elif api_type == "connect":
        raw = _bosch_fetch_activities_connect(token, 50)
        for trip in raw:
            start_time = trip.get("start_time", "") or trip.get("startTime", "")
            date_str = ""
            if isinstance(start_time, (int, float)):
                dt = datetime.fromtimestamp(start_time / 1000)
                date_str = dt.strftime("%Y-%m-%d")
                start_time = dt.isoformat()
            elif isinstance(start_time, str) and len(start_time) >= 10:
                date_str = start_time[:10]

            entry = {
                "date": date_str,
                "start_time": str(start_time),
                "duration_s": trip.get("duration", 0) or trip.get("total_duration", 0),
                "distance_km": round((trip.get("distance", 0) or trip.get("total_distance", 0)) / 1000, 2),
                "avg_power": trip.get("average_power") or trip.get("averagePower") or trip.get("avg_power"),
                "max_power": trip.get("max_power") or trip.get("maxPower"),
                "avg_cadence": trip.get("average_cadence") or trip.get("averageCadence") or trip.get("avg_cadence"),
                "max_cadence": trip.get("max_cadence") or trip.get("maxCadence"),
                "avg_speed_kmh": trip.get("average_speed") or trip.get("averageSpeed"),
                "max_speed_kmh": trip.get("max_speed") or trip.get("maxSpeed"),
                "calories": trip.get("calories") or trip.get("totalCalories"),
                "source": "bosch_connect",
            }

            if entry["avg_power"] or entry["avg_cadence"]:
                bosch_activities.append(entry)

    return bosch_activities


def enrich_activities_with_bosch(activities: list[dict], bosch_activities: list[dict]) -> int:
    """Enrich Garmin/Strava activities with Bosch power/cadence data.
    Matches activities by date and approximate duration (within 20%).
    Returns the number of activities enriched.
    """
    enriched = 0
    for bosch in bosch_activities:
        bosch_date = bosch.get("date", "")
        bosch_dur = bosch.get("duration_s", 0)
        bosch_dist = bosch.get("distance_km", 0)

        best_match = None
        best_score = 0

        for act in activities:
            # Must be same date
            if act.get("date", "") != bosch_date:
                continue
            # Must be a cycling activity
            act_type = (act.get("activityType", "") or "").lower()
            if not any(kw in act_type for kw in ["biking", "cycling", "ride", "mountain", "vtt", "ebike"]):
                continue
            # Already has power? Skip
            if act.get("avg_power") is not None:
                continue

            # Score based on duration and distance similarity
            act_dur = act.get("duration_s", 0)
            act_dist = act.get("distance_km", 0)

            dur_ratio = min(act_dur, bosch_dur) / max(act_dur, bosch_dur) if max(act_dur, bosch_dur) > 0 else 0
            dist_ratio = min(act_dist, bosch_dist) / max(act_dist, bosch_dist) if max(act_dist, bosch_dist) > 0 else 0

            score = (dur_ratio + dist_ratio) / 2

            if score > 0.6 and score > best_score:
                best_match = act
                best_score = score

        if best_match:
            if bosch.get("avg_power"):
                best_match["avg_power"] = round(bosch["avg_power"], 1)
            if bosch.get("max_power"):
                best_match["max_power"] = round(bosch["max_power"], 1)
            if bosch.get("avg_cadence") and best_match.get("avg_cadence") is None:
                best_match["avg_cadence"] = round(bosch["avg_cadence"], 1)
            if bosch.get("max_cadence") and best_match.get("max_cadence") is None:
                best_match["max_cadence"] = round(bosch["max_cadence"], 1)
            enriched += 1

    return enriched


def main():
    print("=== Garmin Live Data Fetch ===")
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    # Authenticate
    print("\n1. Authentication...")
    if not ensure_auth():
        sys.exit(1)

    # Fetch daily data
    print("\n2. Fetching daily wellness data...")
    today = date.today()
    start_date = today - timedelta(days=DAYS_HISTORY)
    days = []

    for i in range(DAYS_HISTORY + 1):
        d = start_date + timedelta(days=i)
        daily = fetch_daily_summary(d)
        if not daily:
            continue
        sleep = fetch_sleep(d)
        hrv = fetch_hrv_daily(d)
        entry = build_daily_entry(d, daily, sleep, hrv)
        days.append(entry)
        sys.stdout.write(f"\r    {d.strftime('%Y-%m-%d')} ({len(days)} days)")
        sys.stdout.flush()

    print(f"\n    Total: {len(days)} days fetched")

    if not days:
        print("ERROR: No data retrieved")
        sys.exit(1)

    # Fetch weight with body composition
    print("\n3. Fetching weight & body composition data...")
    weight_data = fetch_weight(start_date, today)
    weight_history = build_weight_history(weight_data)
    latest_weight = weight_history["latest"]["weight_kg"] if weight_history["latest"] else None
    if latest_weight:
        print(f"    Latest weight: {latest_weight} kg ({len(weight_history['entries'])} entries)")
        if weight_history["latest"].get("body_fat_pct"):
            print(f"    Body fat: {weight_history['latest']['body_fat_pct']}%")
            print(f"    Muscle: {weight_history['latest'].get('muscle_mass_kg', '?')} kg")
            print(f"    Bone: {weight_history['latest'].get('bone_mass_kg', '?')} kg")
            print(f"    Water: {weight_history['latest'].get('body_water_pct', '?')}%")
    else:
        print("    No weight data found")

    # Fetch activity history (last 50 activities for trend analysis)
    print("\n4. Fetching Garmin activity history...")
    garmin_activities = fetch_activity_history(50)
    print(f"    Garmin: {len(garmin_activities)} activities")

    # Fetch Strava activity history (for historical comparisons)
    print("\n4b. Fetching Strava activity history...")
    strava_activities = fetch_strava_activities(max_pages=5)
    print(f"    Strava: {len(strava_activities)} activities")

    # Merge and deduplicate
    activity_history = merge_activity_histories(garmin_activities, strava_activities)
    latest_activity = activity_history[0] if activity_history else None
    print(f"    Total (merged): {len(activity_history)} activities")
    if latest_activity:
        src = latest_activity.get("source", "garmin")
        print(f"    Latest: {latest_activity['name']} ({latest_activity['date']}) [{src}]")
    if len(activity_history) > 1:
        oldest = activity_history[-1]
        src = oldest.get("source", "garmin")
        print(f"    Oldest: {oldest['name']} ({oldest['date']}) [{src}]")

    # Enrich with Bosch Flow data (power/cadence)
    print("\n4c. Fetching Bosch Flow eBike data...")
    bosch_activities = fetch_bosch_activities()
    if bosch_activities:
        print(f"    Bosch: {len(bosch_activities)} rides with power/cadence")
        enriched = enrich_activities_with_bosch(activity_history, bosch_activities)
        print(f"    Enriched: {enriched} activities with Bosch power/cadence data")
        # Also enrich latest activity
        if latest_activity:
            enrich_activities_with_bosch([latest_activity], bosch_activities)
    else:
        if BOSCH_TOKEN_PATH.exists():
            print("    No Bosch data retrieved (token may be expired)")
        else:
            print("    Bosch Flow not configured (run with --bosch-login to set up)")

    # Fetch VO2max
    # Load existing summary for fallback values (before we overwrite it)
    existing_summary = {}
    if OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
                existing_summary = json.load(f)
        except Exception:
            pass

    print("\n5. Fetching VO2max...")
    vo2max = fetch_vo2max()
    print(f"    VO2max: {vo2max}")

    # Fetch fitness age
    print("\n6. Fetching fitness age...")
    fitness_age = fetch_fitness_age()
    print(f"    Fitness age: {fitness_age}")

    # Fallback: load VO2max and fitness age from existing summary (from preprocess_wellness.py)
    if vo2max is None or fitness_age is None:
        if vo2max is None and existing_summary.get("vo2max"):
            vo2max = existing_summary["vo2max"]
            print(f"    VO2max (from export): {vo2max}")
        if fitness_age is None and existing_summary.get("fitnessAge"):
            fitness_age = existing_summary["fitnessAge"]
            print(f"    Fitness age (from export): {fitness_age}")

    # Build biometrics
    biometrics = None
    if latest_weight:
        biometrics = {"weight_kg": latest_weight, "height_cm": None, "vo2max_running": None}

    # Compute aggregates
    weekly_intensity = compute_weekly_intensity(days)
    last_7 = days[-7:] if len(days) >= 7 else days
    hr_trend_7d = [
        {"date": d["date"], "resting": d["heartRate"]["resting"]}
        for d in last_7
        if d["heartRate"]["resting"]
    ]
    hrv_trend_7d = [
        {"date": d["date"], "rmssd": d["sleep"]["hrv_rmssd"], "sdrr": d["sleep"].get("hrv_sdrr"), "status": d["sleep"].get("hrv_status", "")}
        for d in last_7
        if d.get("sleep") and d["sleep"].get("hrv_rmssd") is not None
    ]

    # Generate AI coach bilan
    print("\n7. Generating AI coach bilan...")
    coach_bilan = generate_coach_bilan(days[-1], weekly_intensity, fitness_age, biometrics, vo2max)
    if coach_bilan:
        print("    Coach bilan generated!")
    else:
        if existing_summary.get("coachBilan"):
            coach_bilan = existing_summary["coachBilan"]
            print("    Coach bilan preserved from previous run")
        else:
            print("    Coach bilan skipped")

    # Generate AI coach debriefing (comprehensive analysis)
    print("\n8. Generating AI coach debriefing...")
    wh = weight_history if weight_history["entries"] else None
    coach_debriefing = generate_coach_debriefing(days[-1], weekly_intensity, fitness_age, biometrics, vo2max, latest_activity, wh, days, activity_history)
    if coach_debriefing:
        print("    Coach debriefing generated!")
    else:
        if existing_summary.get("coachDebriefing"):
            coach_debriefing = existing_summary["coachDebriefing"]
            print("    Coach debriefing preserved from previous run")
        else:
            print("    Coach debriefing skipped")

    # Fetch detailed sleep data for the latest night
    print("\n9. Fetching detailed sleep data for latest night...")
    sleep_detail = None
    # Find the most recent day with sleep data
    latest_sleep_date = None
    for d_entry in reversed(days):
        if d_entry.get("sleep") and d_entry["sleep"].get("duration_seconds", 0) > 0:
            latest_sleep_date = d_entry["date"]
            break

    if latest_sleep_date:
        d_sleep = date.fromisoformat(latest_sleep_date)
        sleep_raw = fetch_sleep(d_sleep)
        sleep_detail = build_sleep_detail(sleep_raw)
        if sleep_detail:
            n_levels = len(sleep_detail.get("sleepLevels", []))
            n_hr = len(sleep_detail.get("hrTimeline", []))
            n_resp = len(sleep_detail.get("respTimeline", []))
            n_spo2 = len(sleep_detail.get("spo2Timeline", []))
            n_bb = len(sleep_detail.get("bbTimeline", []))
            print(f"    Date: {latest_sleep_date}")
            print(f"    Sleep levels: {n_levels} epochs")
            print(f"    HR timeline: {n_hr} points")
            print(f"    Respiration: {n_resp} points")
            print(f"    SpO2: {n_spo2} points")
            print(f"    Body battery: {n_bb} points")
        else:
            print("    No detailed sleep data available")
    else:
        print("    No sleep data found in recent days")

    # Build output
    summary = {
        "generated_at": datetime.now().isoformat(),
        "days_count": len(days),
        "latest": days[-1],
        "days": days,
        "weeklyIntensity": weekly_intensity,
        "hrTrend7d": hr_trend_7d,
        "hrvTrend7d": hrv_trend_7d,
        "vo2max": vo2max,
        "fitnessAge": fitness_age,
        "biometrics": biometrics,
        "coachBilan": coach_bilan,
        "coachDebriefing": coach_debriefing,
        "weightHistory": weight_history if weight_history["entries"] else None,
        "latestActivity": latest_activity,
        "activityHistory": activity_history if activity_history else None,
        "sleepDetail": sleep_detail,
    }

    # Write output
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(OUTPUT_PATH)
    print(f"\n=== Done! ===")
    print(f"  Output: {OUTPUT_PATH}")
    print(f"  Size: {size / 1024:.1f} KB")
    print(f"  Days: {len(days)}")
    if latest_weight:
        print(f"  Weight: {latest_weight} kg")
    print(f"  Latest date: {days[-1]['date']}")


def is_cycling_activity(activity: dict) -> bool:
    """Check if activity is a cycling/MTB activity."""
    act_type = (activity.get("activityType", "") or "").lower()
    sport_type = (activity.get("sportType", "") or "").lower()
    name = (activity.get("name", "") or "").lower()
    keywords = ["mountain_biking", "mountain biking", "mtb", "vtt",
                "gravel", "cycling", "road_biking", "vélo", "velo", "bike"]
    return any(kw in act_type or kw in sport_type or kw in name for kw in keywords)


def find_weights_around_activity(activity: dict, weight_entries: list) -> tuple:
    """Find closest weight measurement before and after an activity."""
    act_date = activity.get("date", "")
    act_time = activity.get("startTimeLocal", "12:00")
    if not act_date or not weight_entries:
        return None, None

    act_dt = f"{act_date}T{act_time}"
    sorted_entries = sorted(weight_entries, key=lambda e: f"{e['date']}T{e.get('time', '00:00')}")

    before, after = None, None
    for entry in sorted_entries:
        entry_dt = f"{entry['date']}T{entry.get('time', '00:00')}"
        if entry_dt <= act_dt:
            before = entry
        elif after is None:
            after = entry

    # Also look 1 day after for post-ride weigh-in
    if after is None:
        next_day = (date.fromisoformat(act_date) + timedelta(days=1)).isoformat()
        for entry in sorted_entries:
            if entry["date"] == next_day:
                after = entry
                break

    return before, after


def build_historical_comparison(latest: dict, all_rides: list) -> dict:
    """Build statistical comparison with historical cycling rides."""
    others = [a for a in all_rides if a.get("activityId") != latest.get("activityId")]
    if not others:
        return {"totalRides": len(all_rides), "comparedWith": 0, "stats": {}}

    def safe_list(key):
        return [a.get(key, 0) for a in others if a.get(key) and a.get(key, 0) > 0]

    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else 0

    def pct_rank(value, lst):
        if not lst or not value or value <= 0:
            return None
        return round(sum(1 for v in lst if v < value) / len(lst) * 100)

    def build_stat(key, this_val):
        lst = safe_list(key)
        return {
            "avg": avg(lst), "min": round(min(lst), 1) if lst else 0,
            "max": round(max(lst), 1) if lst else 0,
            "thisRide": round(this_val, 1) if this_val else 0,
            "rank": pct_rank(this_val, lst),
        }

    return {
        "totalRides": len(all_rides),
        "comparedWith": len(others),
        "stats": {
            "distance": build_stat("distance_km", latest.get("distance_km")),
            "duration": build_stat("duration_s", latest.get("duration_s")),
            "speed": build_stat("avg_speed_kmh", latest.get("avg_speed_kmh")),
            "heartRate": build_stat("avg_hr", latest.get("avg_hr")),
            "elevation": build_stat("elevation_gain_m", latest.get("elevation_gain_m")),
            "calories": build_stat("calories", latest.get("calories")),
            "grit": build_stat("grit", latest.get("grit")),
            "flow": build_stat("avg_flow", latest.get("avg_flow")),
        },
    }


def generate_ride_report_ai(activity: dict, weight_before: dict | None, weight_after: dict | None,
                             comparison: dict, vo2max: dict | None, fitness_age: dict | None,
                             all_rides: list) -> dict | None:
    """Generate AI analysis for the ride report using Gemini."""
    if not GEMINI_API_KEY:
        print("    No GEMINI_API_KEY, skipping AI analysis")
        return None

    act = activity
    weight_diff = None
    if weight_before and weight_after:
        weight_diff = round(weight_after["weight_kg"] - weight_before["weight_kg"], 1)

    # Format weight section
    weight_text = ""
    if weight_before:
        weight_text += f"\nPesée AVANT sortie: {weight_before['weight_kg']} kg"
        if weight_before.get("body_fat_pct"):
            weight_text += f" (graisse: {weight_before['body_fat_pct']}%, muscle: {weight_before.get('muscle_mass_kg', '?')} kg, os: {weight_before.get('bone_mass_kg', '?')} kg, eau: {weight_before.get('body_water_pct', '?')}%)"
    if weight_after:
        weight_text += f"\nPesée APRÈS sortie: {weight_after['weight_kg']} kg"
        if weight_after.get("body_fat_pct"):
            weight_text += f" (graisse: {weight_after['body_fat_pct']}%, muscle: {weight_after.get('muscle_mass_kg', '?')} kg, os: {weight_after.get('bone_mass_kg', '?')} kg, eau: {weight_after.get('body_water_pct', '?')}%)"
    if weight_diff is not None:
        weight_text += f"\nDifférence: {weight_diff:+.1f} kg → perte hydrique estimée: {abs(weight_diff * 1000):.0f} ml"
    if not weight_text:
        weight_text = "\nPas de données de pesée disponibles autour de cette sortie."

    # Format comparison
    comp_text = ""
    if comparison and comparison.get("comparedWith", 0) > 0:
        s = comparison["stats"]
        comp_text = f"""
Comparaison avec {comparison['comparedWith']} sorties vélo/VTT précédentes:
- Distance: {act.get('distance_km', 0)} km vs moy {s['distance']['avg']} km (rang: top {100 - (s['distance']['rank'] or 50)}%)
- Vitesse: {act.get('avg_speed_kmh', 0)} km/h vs moy {s['speed']['avg']} km/h (rang: top {100 - (s['speed']['rank'] or 50)}%)
- FC: {act.get('avg_hr', '?')} bpm vs moy {s['heartRate']['avg']} bpm
- Dénivelé: {act.get('elevation_gain_m', 0)} m vs moy {s['elevation']['avg']} m (rang: top {100 - (s['elevation']['rank'] or 50)}%)
- Calories: {act.get('calories', 0)} kcal vs moy {s['calories']['avg']} kcal
- Grit: {act.get('grit', '?')} vs moy {s['grit']['avg']}
- Flow: {act.get('avg_flow', '?')} vs moy {s['flow']['avg']}"""

    # Recent 5 rides for trend
    recent = ""
    for i, r in enumerate(all_rides[:5]):
        recent += f"\n  {i+1}. {r.get('date', '?')} {r.get('name', '?')}: {r.get('distance_km', 0)} km, {r.get('avg_speed_kmh', 0)} km/h, D+{r.get('elevation_gain_m', 0)}m, FC {r.get('avg_hr', '?')} bpm, {r.get('calories', 0)} kcal, grit {r.get('grit', '?')}"

    # HR zones breakdown
    hr_zones_text = ""
    zones = act.get("hrZones") or []
    if zones:
        zone_names = ["Repos", "Échauffement", "Aérobie", "Tempo", "Seuil", "VO2max", "Anaérobie"]
        for z in zones:
            zi = z.get("zone", 0)
            secs = z.get("seconds", 0)
            name = zone_names[zi] if zi < len(zone_names) else f"Zone {zi}"
            hr_zones_text += f"\n  Zone {zi} ({name}): {secs // 60} min {secs % 60}s"

    prompt = f"""Tu es un coach sportif expert en VTT/cyclisme. Génère un rapport ULTRA-DÉTAILLÉ pour cette sortie.

## ACTIVITÉ: {act.get('name', 'VTT')} — {act.get('date', '?')}
- Départ: {act.get('startTimeLocal', '?')} à {act.get('location', 'inconnu')}
- Distance: {act.get('distance_km', 0)} km
- Durée totale: {act.get('duration_s', 0) // 60} min (mouvement: {act.get('moving_duration_s', 0) // 60} min, arrêts: {((act.get('elapsed_duration_s', 0) or act.get('duration_s', 0)) - (act.get('moving_duration_s', 0) or act.get('duration_s', 0))) // 60} min)
- Vitesse: moy {act.get('avg_speed_kmh', 0)} km/h, max {act.get('max_speed_kmh', 0)} km/h
- Dénivelé: +{act.get('elevation_gain_m', 0)} m / -{act.get('elevation_loss_m', 0)} m (alt min {act.get('min_elevation_m', '?')}m → max {act.get('max_elevation_m', '?')}m)
- FC: moy {act.get('avg_hr', '?')} bpm, max {act.get('max_hr', '?')} bpm, min {act.get('min_hr', '?')} bpm
- Zones FC: {hr_zones_text}
- Cadence: moy {act.get('avg_cadence', '?')} rpm, max {act.get('max_cadence', '?')} rpm
- Puissance: moy {act.get('avg_power', '?')} W, max {act.get('max_power', '?')} W, NP {act.get('norm_power', '?')} W
- Calories brûlées: {act.get('calories', 0)} kcal
- Training Effect aérobie: {act.get('aerobic_te', '?')}/5, anaérobie: {act.get('anaerobic_te', '?')}/5
- Training Load: {act.get('training_load', '?')}
- Grit (difficulté technique): {act.get('grit', '?')}
- Flow (fluidité): {act.get('avg_flow', '?')}
- Sauts détectés: {act.get('jump_count', 0)}
- Température: {act.get('min_temp_c', '?')}°C à {act.get('max_temp_c', '?')}°C
- Respiration: moy {act.get('avg_respiration', '?')}, max {act.get('max_respiration', '?')} resp/min
- Eau estimée perdue: {act.get('water_estimated_ml', '?')} ml
- Minutes modérées: {act.get('moderate_minutes', 0)}, vigoureuses: {act.get('vigorous_minutes', 0)}

## PESÉES (balance Garmin Index S2){weight_text}

## COMPARAISON HISTORIQUE{comp_text}

## 5 DERNIÈRES SORTIES VÉLO/VTT{recent}

## CONDITION PHYSIQUE
- VO2max: {vo2max.get('vo2max', '?') if vo2max else 'non disponible'}
- Fitness Age: {fitness_age.get('fitnessAge', '?') if fitness_age else '?'} ans (âge réel: {fitness_age.get('chronologicalAge', '?') if fitness_age else '?'})
- IMC: {fitness_age.get('bmi', '?') if fitness_age else '?'}
- FC repos: {fitness_age.get('rhr', '?') if fitness_age else '?'} bpm

Réponds en JSON (UNIQUEMENT le JSON, rien d'autre):
{{
  "title": "Titre accrocheur pour cette sortie (français, max 60 car)",
  "overallScore": 82,
  "overallVerdict": "Verdict global percutant en 2-3 phrases",
  "performanceAnalysis": "Analyse détaillée de la performance (effort cardiaque, gestion d'intensité, ratio dénivelé/distance, vitesse vs terrain). 6-10 phrases.",
  "weightAnalysis": "Analyse pesée avant/après: perte hydrique, impact sur la performance, comparaison composition corporelle, conseils réhydratation. 4-6 phrases. Si pas de données, le préciser.",
  "comparisonAnalysis": "Comparaison approfondie avec l'historique: progression/régression par métrique, tendance globale, points d'inflexion. 6-8 phrases.",
  "technicalAnalysis": "Analyse du pilotage VTT: grit vs flow (ratio technique), cadence, gestion des relances, lecture du terrain. 4-6 phrases.",
  "physiologicalAnalysis": "VO2max, Training Effect, Training Load, respiration, zones FC. Impact cumulé sur la forme. 5-7 phrases.",
  "calorieAnalysis": "Bilan énergétique: calories dépensées vs effort, rapport cal/km, cal/heure, estimation des besoins de récupération nutritionnelle. 3-5 phrases.",
  "positives": ["Point positif 1 (précis et chiffré)", "Point positif 2", "Point positif 3", "Point positif 4", "Point positif 5"],
  "negatives": ["Point d'amélioration 1 (précis et chiffré)", "Point d'amélioration 2", "Point d'amélioration 3"],
  "recommendations": ["Reco concrète 1 avec chiffres", "Reco concrète 2", "Reco concrète 3", "Reco concrète 4"],
  "recoveryPlan": "Plan récupération post-sortie: quoi manger (grammes), combien boire (ml), quand dormir, étirements, prochaine séance. 5-7 phrases.",
  "nextRideAdvice": "Conseil prochaine sortie VTT: type de parcours, intensité cible (zones FC), durée, points à travailler spécifiquement. 4-6 phrases."
}}"""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096}
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload,
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3].strip()
            if text.startswith("json"):
                text = text[4:].strip()
            return json.loads(text)
    except Exception as e:
        print(f"    AI ride analysis failed: {e}")
        return None


def ride_report_main():
    """Generate a detailed report for the latest cycling/MTB ride."""
    print("=== Rapport Détaillé Sortie VTT ===")

    # Read existing wellness data
    wellness_path = OUTPUT_PATH
    if not wellness_path.exists():
        # Try data dir
        data_dir = Path(os.environ.get("PIERRE_DATA_DIR", "/app/data"))
        wellness_path = data_dir / "wellness_summary.json"

    if not wellness_path.exists():
        print("ERROR: No wellness data found. Run a refresh first.")
        report = {"ok": False, "error": "Pas de données wellness. Cliquez d'abord sur Actualiser."}
        report_path = Path(os.environ.get("RIDE_REPORT_OUTPUT", str(OUTPUT_PATH.parent / "ride_report.json")))
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return

    print(f"  Reading: {wellness_path}")
    with open(wellness_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Find all cycling/MTB activities
    all_activities = data.get("activityHistory") or []
    cycling_rides = [a for a in all_activities if is_cycling_activity(a)]
    print(f"  Total activities: {len(all_activities)}, cycling/MTB: {len(cycling_rides)}")

    if not cycling_rides:
        report = {"ok": False, "error": "Aucune sortie vélo/VTT trouvée dans l'historique."}
        report_path = Path(os.environ.get("RIDE_REPORT_OUTPUT", str(OUTPUT_PATH.parent / "ride_report.json")))
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return

    latest = cycling_rides[0]
    print(f"  Latest ride: {latest.get('name', '?')} ({latest.get('date', '?')})")

    # Find weight before/after
    weight_entries = (data.get("weightHistory") or {}).get("entries", [])
    weight_before, weight_after = find_weights_around_activity(latest, weight_entries)
    if weight_before:
        print(f"  Weight before: {weight_before['weight_kg']} kg ({weight_before['date']} {weight_before.get('time', '')})")
    if weight_after:
        print(f"  Weight after: {weight_after['weight_kg']} kg ({weight_after['date']} {weight_after.get('time', '')})")

    # Historical comparison
    print(f"\n  Building comparison with {len(cycling_rides)} rides...")
    comparison = build_historical_comparison(latest, cycling_rides)

    # Context data
    vo2max = data.get("vo2max")
    fitness_age = data.get("fitnessAge")

    # HRV readiness: find sleep data for the night before the ride
    ride_date = latest.get("date", "")
    days = data.get("days") or []
    pre_ride_hrv = None
    for day in days:
        if day.get("date") == ride_date and day.get("sleep"):
            sleep = day["sleep"]
            pre_ride_hrv = {
                "hrv_rmssd": sleep.get("hrv_rmssd"),
                "hrv_sdrr": sleep.get("hrv_sdrr"),
                "hrv_status": sleep.get("hrv_status"),
                "sleep_score": sleep.get("score"),
                "body_battery": day.get("bodyBattery", {}).get("estimate"),
                "stress_avg": day.get("stress", {}).get("average"),
            }
            break

    # Generate AI analysis
    print("\n  Generating AI analysis...")
    ai_analysis = generate_ride_report_ai(
        latest, weight_before, weight_after,
        comparison, vo2max, fitness_age, cycling_rides
    )
    if ai_analysis:
        print(f"  AI score: {ai_analysis.get('overallScore', '?')}/100")
    else:
        print("  AI analysis not available")

    # Build the complete report
    weight_comparison = None
    if weight_before or weight_after:
        weight_comparison = {
            "before": weight_before,
            "after": weight_after,
        }
        if weight_before and weight_after:
            diff = round(weight_after["weight_kg"] - weight_before["weight_kg"], 1)
            weight_comparison["diff_kg"] = diff
            weight_comparison["estimated_sweat_loss_ml"] = abs(round(diff * 1000))

    report = {
        "ok": True,
        "generated_at": datetime.now().isoformat(),
        "activity": latest,
        "preRideHrv": pre_ride_hrv,
        "weightComparison": weight_comparison,
        "historicalComparison": comparison,
        "vo2max": vo2max,
        "fitnessAge": fitness_age,
        "allRides": [{"date": r.get("date"), "name": r.get("name"), "distance_km": r.get("distance_km"),
                       "avg_speed_kmh": r.get("avg_speed_kmh"), "elevation_gain_m": r.get("elevation_gain_m"),
                       "avg_hr": r.get("avg_hr"), "calories": r.get("calories"), "grit": r.get("grit"),
                       "avg_flow": r.get("avg_flow"), "training_load": r.get("training_load")}
                      for r in cycling_rides[:20]],
        "aiAnalysis": ai_analysis,
    }

    report_path = Path(os.environ.get("RIDE_REPORT_OUTPUT", str(OUTPUT_PATH.parent / "ride_report.json")))
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(report_path)
    print(f"\n=== Rapport généré! ===")
    print(f"  Output: {report_path}")
    print(f"  Size: {size / 1024:.1f} KB")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fetch Garmin + Bosch wellness data")
    parser.add_argument("--bosch-login", nargs=2, metavar=("EMAIL", "PASSWORD"),
                        help="Login to Bosch eBike Connect with email and password")
    parser.add_argument("--bosch-flow-code", type=str,
                        help="Exchange Bosch Flow OAuth authorization code for tokens")
    parser.add_argument("--ride-report", action="store_true",
                        help="Generate a detailed report for the latest MTB/cycling ride")
    args = parser.parse_args()

    if args.bosch_login:
        email, password = args.bosch_login
        print(f"Logging in to Bosch eBike Connect as {email}...")
        result = bosch_initial_login(email, password)
        if result:
            print(f"  Success! Token saved to {BOSCH_TOKEN_PATH}")
        else:
            print("  Login failed.")
        sys.exit(0 if result else 1)

    if args.bosch_flow_code:
        print("Exchanging Bosch Flow authorization code...")
        result = bosch_save_flow_token(args.bosch_flow_code)
        if result:
            print(f"  Success! Tokens saved to {BOSCH_TOKEN_PATH}")
        else:
            print("  Token exchange failed.")
        sys.exit(0 if result else 1)

    if args.ride_report:
        ride_report_main()
        sys.exit(0)

    main()
