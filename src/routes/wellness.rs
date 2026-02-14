// ABOUTME: Wellness data route handlers for real-time health metrics
// ABOUTME: Provides REST endpoints for accessing wellness summary including sleep, activities, and health metrics
//
// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

//! Wellness routes for health and fitness data
//!
//! This module provides endpoints for retrieving wellness summary data in real-time,
//! including sleep metrics, activity data, and health statistics from connected providers.

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
        // Try Authorization header first
        let auth_value =
            if let Some(auth_header) = headers.get("authorization").and_then(|h| h.to_str().ok()) {
                auth_header.to_owned()
            } else if let Some(token) = get_cookie_value(headers, "auth_token") {
                // Fall back to auth_token cookie, format as Bearer token
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
    fn build_request(
        tool_name: &str,
        parameters: Value,
        auth: &AuthResult,
    ) -> UniversalRequest {
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
    /// This endpoint aggregates data from multiple sources:
    /// - Activities (recent workouts)
    /// - Athlete profile (biometrics, fitness age)
    /// - Stats (aggregated metrics)
    async fn handle_wellness_summary(
        State(resources): State<Arc<ServerResources>>,
        headers: HeaderMap,
    ) -> Result<Response, AppError> {
        let auth = Self::authenticate(&headers, &resources).await?;

        // Create executor for running MCP tools
        let executor = UniversalExecutor::new(resources.clone());

        // Fetch recent activities (last 30 days)
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

        // Build wellness summary response
        let summary = json!({
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "activities": activities_response.ok().and_then(|r| r.result),
            "athlete": athlete_response.ok().and_then(|r| r.result),
            "stats": stats_response.ok().and_then(|r| r.result),
            // Note: Sleep data would come from a dedicated sleep provider integration
            // For now, we return null to maintain compatibility with existing frontend
            "sleep": null,
            "days": [],
            "weeklyIntensity": null,
            "hrTrend7d": [],
            "vo2max": null,
            "fitnessAge": null,
            "biometrics": null,
            "coachBilan": null,
            "coachDebriefing": null,
            "weightHistory": null,
            "latestActivity": null,
            "activityHistory": null,
        });

        Ok((StatusCode::OK, Json(summary)).into_response())
    }
}
