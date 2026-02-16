// ABOUTME: Wellness data route handlers for real-time health metrics
// ABOUTME: Provides REST endpoints for accessing wellness summary including activities, athlete profile, and health metrics
//
// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

//! Wellness routes for health and fitness data
//!
//! This module provides endpoints for retrieving wellness summary data in real-time,
//! including activity data, athlete profile, and health statistics from connected providers.

use crate::{
    auth::AuthResult,
    errors::AppError,
    mcp::resources::ServerResources,
    protocols::universal::{
        executor::UniversalExecutor,
        handlers::fitness_api::{handle_get_activities, handle_get_athlete, handle_get_stats},
        UniversalRequest,
    },
    security::cookies::get_cookie_value,
};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

/// Wellness routes
pub struct WellnessRoutes;

impl WellnessRoutes {
    /// Create all wellness routes
    pub fn routes(resources: Arc<ServerResources>) -> Router {
        Router::new()
            .route("/api/wellness/summary", get(Self::handle_wellness_summary))
            .with_state(resources)
    }

    /// Extract and authenticate user from authorization header or cookie
    async fn authenticate(
        headers: &HeaderMap,
        resources: &Arc<ServerResources>,
    ) -> Result<AuthResult, AppError> {
        let auth_value =
            if let Some(auth_header) = headers.get("authorization").and_then(|h| h.to_str().ok()) {
                auth_header.to_owned()
            } else if let Some(token) = get_cookie_value(headers, "auth_token") {
                format!("Bearer {token}")
            } else {
                return Err(AppError::auth_invalid(
                    "Missing authorization header or cookie",
                ));
            };

        resources
            .auth_middleware
            .authenticate_request(Some(&auth_value))
            .await
            .map_err(|e| AppError::auth_invalid(format!("Authentication failed: {e}")))
    }

    /// Build a universal request for MCP tool execution
    fn build_request(tool_name: &str, parameters: Value, auth: &AuthResult) -> UniversalRequest {
        UniversalRequest {
            tool_name: tool_name.to_owned(),
            parameters,
            user_id: auth.user_id.to_string(),
            protocol: "rest".to_owned(),
            tenant_id: auth.active_tenant_id.map(|id| id.to_string()),
            progress_token: None,
            cancellation_token: None,
            progress_reporter: None,
        }
    }

    /// Handle wellness summary request
    ///
    /// Aggregates data from activities, athlete profile, and stats,
    /// then transforms into the WellnessSummary format expected by the frontend.
    async fn handle_wellness_summary(
        State(resources): State<Arc<ServerResources>>,
        headers: HeaderMap,
    ) -> Result<Response, AppError> {
        let auth = Self::authenticate(&headers, &resources).await?;
        let executor = UniversalExecutor::new(resources.clone());

        // Fetch recent activities (last 30)
        let activities_params = json!({
            "limit": 30,
            "mode": "detailed",
            "format": "json"
        });
        let activities_request = Self::build_request("get_activities", activities_params, &auth);
        let activities_response = handle_get_activities(&executor, activities_request).await;

        // Fetch athlete profile
        let athlete_params = json!({ "format": "json" });
        let athlete_request = Self::build_request("get_athlete", athlete_params, &auth);
        let athlete_response = handle_get_athlete(&executor, athlete_request).await;

        // Fetch stats
        let stats_params = json!({ "format": "json" });
        let stats_request = Self::build_request("get_stats", stats_params, &auth);
        let stats_response = handle_get_stats(&executor, stats_request).await;

        // Extract raw results
        let activities_result = activities_response.ok().and_then(|r| r.result);
        let athlete_result = athlete_response.ok().and_then(|r| r.result);
        let _stats_result = stats_response.ok().and_then(|r| r.result);

        let summary = Self::build_wellness_summary(activities_result, athlete_result);
        Ok((StatusCode::OK, Json(summary)).into_response())
    }

    /// Build the complete WellnessSummary from raw API responses
    fn build_wellness_summary(
        activities_result: Option<Value>,
        athlete_result: Option<Value>,
    ) -> Value {
        // Extract raw activities array
        let raw_activities = activities_result
            .as_ref()
            .and_then(|v| v.get("activities"))
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        // Transform activities to frontend ActivitySummary format
        let activity_history: Vec<Value> = raw_activities
            .iter()
            .map(Self::transform_activity)
            .collect();
        let latest_activity = activity_history.first().cloned();

        // Compute derived metrics
        let hr_trend = Self::build_hr_trend(&raw_activities);
        let weekly_intensity = Self::build_weekly_intensity(&raw_activities);
        let biometrics = Self::extract_biometrics(&athlete_result);

        // Build today's WellnessDay
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let latest = Self::build_latest_wellness_day(&today, &raw_activities);
        let days = vec![latest.clone()];

        json!({
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "days_count": days.len(),
            "latest": latest,
            "days": days,
            "weeklyIntensity": weekly_intensity,
            "hrTrend7d": hr_trend,
            "vo2max": null,
            "fitnessAge": null,
            "biometrics": biometrics,
            "coachBilan": null,
            "coachDebriefing": null,
            "weightHistory": null,
            "latestActivity": latest_activity,
            "activityHistory": activity_history
        })
    }

    /// Transform a raw provider activity into the frontend ActivitySummary format
    fn transform_activity(a: &Value) -> Value {
        let distance_m = a
            .get("distance_meters")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let avg_speed = a
            .get("average_speed")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let max_speed = a.get("max_speed").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let duration = a
            .get("duration_seconds")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let start_date_str = a.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
        let date = start_date_str.split('T').next().unwrap_or(start_date_str);
        let elevation_gain = a
            .get("elevation_gain")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let activity_id = a
            .get("id")
            .map(|v| match v {
                Value::String(s) => s.parse::<i64>().unwrap_or(0),
                Value::Number(n) => n.as_i64().unwrap_or(0),
                _ => 0,
            })
            .unwrap_or(0);

        let hr_zones: Vec<Value> = a
            .get("heart_rate_zones")
            .and_then(|v| v.as_array())
            .map(|zones| {
                zones
                    .iter()
                    .enumerate()
                    .map(|(i, z)| {
                        let minutes = z.get("minutes").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        json!({ "zone": i + 1, "seconds": (minutes * 60.0) as i64 })
                    })
                    .collect()
            })
            .unwrap_or_default();

        let avg_hr = a.get("average_heart_rate").cloned().unwrap_or(Value::Null);
        let max_hr = a.get("max_heart_rate").cloned().unwrap_or(Value::Null);
        let suffer_score = a.get("suffer_score").cloned().unwrap_or(Value::Null);
        let temperature = a.get("temperature").cloned().unwrap_or(Value::Null);
        let breathing_rate = a.get("breathing_rate").cloned().unwrap_or(Value::Null);
        let start_lat = a.get("start_latitude").cloned().unwrap_or(Value::Null);
        let start_lng = a.get("start_longitude").cloned().unwrap_or(Value::Null);
        let location = a
            .get("city")
            .and_then(|v| v.as_str())
            .map(|s| Value::String(s.to_owned()))
            .unwrap_or(Value::Null);
        let provider = a
            .get("provider")
            .and_then(|v| v.as_str())
            .map(|s| Value::String(s.to_owned()))
            .unwrap_or(Value::Null);
        let training_load = a
            .get("training_stress_score")
            .cloned()
            .unwrap_or(Value::Null);

        json!({
            "activityId": activity_id,
            "name": a.get("name").and_then(|v| v.as_str()).unwrap_or("Activity"),
            "activityType": a.get("sport_type").and_then(|v| v.as_str()).unwrap_or("Other"),
            "sportType": a.get("sport_type").and_then(|v| v.as_str()).unwrap_or("Other"),
            "date": date,
            "startTimeLocal": start_date_str,
            "location": location,
            "duration_s": duration as i64,
            "moving_duration_s": duration as i64,
            "elapsed_duration_s": duration as i64,
            "distance_km": (distance_m / 1000.0 * 100.0).round() / 100.0,
            "avg_speed_kmh": (avg_speed * 3.6 * 100.0).round() / 100.0,
            "max_speed_kmh": (max_speed * 3.6 * 100.0).round() / 100.0,
            "elevation_gain_m": elevation_gain,
            "elevation_loss_m": 0.0,
            "min_elevation_m": 0.0,
            "max_elevation_m": 0.0,
            "avg_hr": avg_hr,
            "max_hr": max_hr,
            "min_hr": null,
            "hrZones": hr_zones,
            "calories": a.get("calories").and_then(|v| v.as_f64()).unwrap_or(0.0) as i64,
            "calories_consumed": null,
            "aerobic_te": null,
            "anaerobic_te": null,
            "training_load": training_load,
            "te_label": null,
            "min_temp_c": null,
            "max_temp_c": temperature,
            "avg_respiration": breathing_rate,
            "min_respiration": null,
            "max_respiration": null,
            "water_estimated_ml": null,
            "water_consumed_ml": null,
            "grit": null,
            "avg_flow": null,
            "jump_count": null,
            "suffer_score": suffer_score,
            "source": provider,
            "moderate_minutes": 0,
            "vigorous_minutes": 0,
            "startLatitude": start_lat,
            "startLongitude": start_lng
        })
    }

    /// Build HR trend from the last 7 unique activity dates
    fn build_hr_trend(activities: &[Value]) -> Vec<Value> {
        let mut date_hrs: HashMap<String, Vec<f64>> = HashMap::new();
        for a in activities {
            if let (Some(date_str), Some(hr)) = (
                a.get("start_date").and_then(|v| v.as_str()),
                a.get("average_heart_rate").and_then(|v| v.as_f64()),
            ) {
                let date = date_str.split('T').next().unwrap_or(date_str).to_string();
                date_hrs.entry(date).or_default().push(hr);
            }
        }

        let mut trend: Vec<Value> = date_hrs
            .into_iter()
            .map(|(date, hrs)| {
                let avg = hrs.iter().sum::<f64>() / hrs.len() as f64;
                json!({ "date": date, "resting": avg.round() as i64 })
            })
            .collect();

        trend.sort_by(|a, b| {
            let da = a.get("date").and_then(|v| v.as_str()).unwrap_or("");
            let db = b.get("date").and_then(|v| v.as_str()).unwrap_or("");
            da.cmp(db)
        });

        // Keep last 7 dates
        if trend.len() > 7 {
            trend = trend[trend.len() - 7..].to_vec();
        }

        trend
    }

    /// Build weekly intensity summary from activities in the last 7 days
    fn build_weekly_intensity(activities: &[Value]) -> Value {
        let now = chrono::Utc::now();
        let mut moderate_min: i64 = 0;
        let mut vigorous_min: i64 = 0;
        let mut daily: HashMap<String, (i64, i64)> = HashMap::new();

        for a in activities {
            let start = a.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(start) {
                let age = now.signed_duration_since(dt);
                if age.num_days() > 7 {
                    continue;
                }
                let date = dt.format("%Y-%m-%d").to_string();
                let duration_s = a
                    .get("duration_seconds")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                let avg_hr = a
                    .get("average_heart_rate")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                let dur_min = (duration_s / 60.0) as i64;

                // HR > 150 = vigorous, HR > 120 or no HR data = moderate
                if avg_hr > 150.0 {
                    vigorous_min += dur_min;
                    daily.entry(date).or_default().1 += dur_min;
                } else if avg_hr > 120.0 || avg_hr == 0.0 {
                    moderate_min += dur_min;
                    daily.entry(date).or_default().0 += dur_min;
                }
            }
        }

        let days: Vec<Value> = daily
            .into_iter()
            .map(|(date, (m, v))| json!({ "date": date, "moderate": m, "vigorous": v }))
            .collect();

        json!({
            "moderate": moderate_min,
            "vigorous": vigorous_min,
            "total": moderate_min + vigorous_min * 2,
            "goal": 150,
            "days": days
        })
    }

    /// Extract biometrics from athlete profile if weight is available
    fn extract_biometrics(athlete_result: &Option<Value>) -> Value {
        athlete_result
            .as_ref()
            .and_then(|v| v.get("athlete"))
            .and_then(|athlete| {
                let weight = athlete.get("weight").and_then(|v| v.as_f64())?;
                let height_cm = athlete.get("height").cloned().unwrap_or(Value::Null);
                Some(json!({
                    "weight_kg": weight,
                    "height_cm": height_cm,
                    "vo2max_running": null
                }))
            })
            .unwrap_or(Value::Null)
    }

    /// Build the latest WellnessDay from today's activity data
    fn build_latest_wellness_day(today: &str, activities: &[Value]) -> Value {
        // Sum calories from today's activities
        let today_calories: f64 = activities
            .iter()
            .filter(|a| {
                a.get("start_date")
                    .and_then(|v| v.as_str())
                    .map(|d| d.starts_with(today))
                    .unwrap_or(false)
            })
            .filter_map(|a| a.get("calories").and_then(|v| v.as_f64()))
            .sum();

        // Get HR from most recent activity
        let latest = activities.first();
        let resting_hr = latest
            .and_then(|a| a.get("average_heart_rate"))
            .cloned()
            .unwrap_or(Value::Null);
        let max_hr = latest
            .and_then(|a| a.get("max_heart_rate"))
            .cloned()
            .unwrap_or(Value::Null);

        // Sum elevation from today's activities
        let today_elevation: f64 = activities
            .iter()
            .filter(|a| {
                a.get("start_date")
                    .and_then(|v| v.as_str())
                    .map(|d| d.starts_with(today))
                    .unwrap_or(false)
            })
            .filter_map(|a| a.get("elevation_gain").and_then(|v| v.as_f64()))
            .sum();

        json!({
            "date": today,
            "steps": { "count": 0, "goal": 10000, "distance_m": 0 },
            "heartRate": { "resting": resting_hr, "min": null, "max": max_hr },
            "calories": { "total": today_calories as i64, "active": today_calories as i64, "bmr": 0 },
            "stress": { "average": null, "max": null, "low_minutes": 0, "medium_minutes": 0, "high_minutes": 0, "rest_minutes": 0 },
            "intensityMinutes": { "moderate": 0, "vigorous": 0, "goal": 150 },
            "bodyBattery": { "estimate": null },
            "sleep": null,
            "floors": { "ascended_m": today_elevation, "descended_m": 0.0 }
        })
    }
}
