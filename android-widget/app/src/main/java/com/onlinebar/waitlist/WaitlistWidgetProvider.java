package com.onlinebar.waitlist;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class WaitlistWidgetProvider extends AppWidgetProvider {
    static final String PREFERENCES = "online_bar_waitlist_widget";
    static final String REFERRAL_CODE = "referral_code";
    static final String MEMBER_TOKEN = "member_token";
    static final String AGE_GROUP = "age_group";
    static final String REFRESH_ACTION = "com.onlinebar.waitlist.REFRESH_WIDGET";
    static final String SAVE_PROGRESS_ACTION = "com.onlinebar.waitlist.SAVE_MEMBER_PROGRESS";
    private static final String CACHE = "widget_cache";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            render(context, manager, appWidgetId, cachedData(context));
        }
        refreshFromNetwork(context, goAsync());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (REFRESH_ACTION.equals(action) || SAVE_PROGRESS_ACTION.equals(action)) {
            refreshFromNetwork(context, goAsync());
            return;
        }
        super.onReceive(context, intent);
    }

    static void requestRefresh(Context context) {
        Intent intent = new Intent(context, WaitlistWidgetProvider.class).setAction(REFRESH_ACTION);
        context.sendBroadcast(intent);
    }

    private static void refreshFromNetwork(Context context, PendingResult result) {
        Context appContext = context.getApplicationContext();
        if (BuildConfig.WAITLIST_SITE_URL.isEmpty()) {
            JSONObject errorData = cachedData(appContext);
            try {
                errorData.put("refresh_error", "Waitlist site URL is not configured.");
            } catch (Exception error) {
                android.util.Log.e("WaitlistWidget", "Could not save widget configuration status.", error);
            }
            renderAll(appContext, errorData);
            result.finish();
            return;
        }
        EXECUTOR.execute(() -> {
            try {
                JSONObject content = getJson(BuildConfig.WAITLIST_SITE_URL + "/api/content");
                JSONObject site = content.optJSONObject("content");
                if (site == null) throw new IllegalStateException("Published waitlist content is missing.");
                JSONObject data = new JSONObject();
                data.put("launch_at", site.isNull("launch_at") ? "" : site.optString("launch_at", ""));
                data.put("tokens_per_referral", site.optInt("tokens_per_referral", 0));
                data.put("launch_message", site.optString("headline", "THE COUNTDOWN IS ON"));
                data.remove("refresh_error");
                String memberToken = appContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                        .getString(MEMBER_TOKEN, "");
                if (!memberToken.isEmpty()) {
                    JSONObject member = getMemberJson(BuildConfig.WAITLIST_SITE_URL + "/api/member", memberToken);
                    data.put("referrals", member.optInt("referralsJoined", 0));
                    data.put("tokens_earned", member.optInt("tokensEarned", 0));
                    data.put("tokens_available", member.optInt("tokensAvailable", 0));
                    data.put("reward_path", member.optString("rewardPath", ""));
                }
                appContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                        .edit()
                        .putString(CACHE, data.toString())
                        .apply();
            } catch (Exception error) {
                android.util.Log.e("WaitlistWidget", "Could not refresh the launch widget.", error);
                JSONObject errorData = cachedData(appContext);
                try {
                    errorData.put("refresh_error", "Progress unavailable · open the tracker to retry");
                    appContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                            .edit()
                            .putString(CACHE, errorData.toString())
                            .apply();
                } catch (Exception cacheError) {
                    android.util.Log.e("WaitlistWidget", "Could not cache widget refresh status.", cacheError);
                }
            } finally {
                renderAll(appContext, cachedData(appContext));
                result.finish();
            }
        });
    }

    private static void renderAll(Context context, JSONObject data) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, WaitlistWidgetProvider.class));
        for (int id : ids) render(context, manager, id, data);
    }

    private static JSONObject getJson(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        return readJson(connection);
    }

    private static JSONObject getMemberJson(String address, String memberToken) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("Authorization", "Bearer " + memberToken);
        return readJson(connection);
    }

    private static JSONObject readJson(HttpURLConnection connection) throws Exception {
        try {
            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            if (stream == null) throw new IllegalStateException("The waitlist server returned HTTP " + status + ".");
            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("The waitlist server returned HTTP " + status + ".");
            }
            return new JSONObject(body.toString());
        } finally {
            connection.disconnect();
        }
    }

    private static JSONObject cachedData(Context context) {
        String json = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(CACHE, "{}");
        try {
            return new JSONObject(json);
        } catch (Exception error) {
            android.util.Log.e("WaitlistWidget", "Saved widget data is invalid.", error);
            return new JSONObject();
        }
    }

    private static void render(Context context, AppWidgetManager manager, int widgetId, JSONObject data) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.waitlist_widget);
        String launchAt = data.optString("launch_at", "");
        if (launchAt.isEmpty()) {
            views.setTextViewText(R.id.widget_launch_message, "LAUNCH DATE TO BE ANNOUNCED");
            views.setTextViewText(R.id.widget_days, "Launch date coming soon");
            views.setViewVisibility(R.id.widget_clock, android.view.View.GONE);
        } else {
            try {
                Instant launch = Instant.parse(launchAt);
                long remaining = launch.toEpochMilli() - System.currentTimeMillis();
                long remainingDays = Math.max(0, ChronoUnit.DAYS.between(
                        LocalDate.now(),
                        launch.atZone(ZoneId.systemDefault()).toLocalDate()
                ));
                views.setTextViewText(R.id.widget_days, remainingDays + (remainingDays == 1 ? " DAY LEFT" : " DAYS LEFT"));
                views.setViewVisibility(R.id.widget_clock, remaining > 0 ? android.view.View.VISIBLE : android.view.View.GONE);
                if (remaining > 0) {
                    views.setChronometer(R.id.widget_clock, SystemClock.elapsedRealtime() + remaining, "%s", true);
                    views.setChronometerCountDown(R.id.widget_clock, true);
                } else {
                    views.setTextViewText(R.id.widget_launch_message, "YOU MADE IT. WE’RE LIVE.");
                }
                if (remaining > 30L * 24 * 60 * 60 * 1000) {
                    views.setTextViewText(R.id.widget_launch_message, "THE WAIT BEGINS");
                } else if (remaining > 14L * 24 * 60 * 60 * 1000) {
                    views.setTextViewText(R.id.widget_launch_message, "THE COUNTDOWN IS ON");
                } else if (remaining > 7L * 24 * 60 * 60 * 1000) {
                    views.setTextViewText(R.id.widget_launch_message, "YOU’RE GETTING CLOSE");
                } else if (remaining > 3L * 24 * 60 * 60 * 1000) {
                    views.setTextViewText(R.id.widget_launch_message, "DON’T MISS THIS");
                } else if (remaining > 24L * 60 * 60 * 1000) {
                    views.setTextViewText(R.id.widget_launch_message, "YOUR FRIENDS ARE JOINING");
                } else if (remaining > 0) {
                    boolean tomorrow = !LocalDate.now().equals(launch.atZone(ZoneId.systemDefault()).toLocalDate());
                    views.setTextViewText(R.id.widget_launch_message, tomorrow ? "TOMORROW. 🔥" : "LAUNCH DAY. 🔥");
                }
            } catch (Exception error) {
                android.util.Log.e("WaitlistWidget", "Launch time could not be parsed.", error);
                views.setTextViewText(R.id.widget_launch_message, "LAUNCH DATE UNAVAILABLE");
                views.setTextViewText(R.id.widget_days, "Open the tracker for updates");
                views.setViewVisibility(R.id.widget_clock, android.view.View.GONE);
            }
        }

        String path = data.optString("reward_path", "");
        String pathLabel = "wine".equals(path) ? "Wine & good living"
                : "adventure".equals(path) ? "Adventure & experiences"
                : "music".equals(path) ? "Music & madness" : "";
        if (data.has("refresh_error")) {
            views.setTextViewText(R.id.widget_progress, data.optString("refresh_error"));
        } else if (data.has("referrals")) {
            views.setTextViewText(
                    R.id.widget_progress,
                    (pathLabel.isEmpty() ? "" : pathLabel + "  ·  ")
                            + data.optInt("referrals") + " friends joined  ·  "
                            + data.optInt("tokens_available") + " tokens"
            );
        } else if (!pathLabel.isEmpty()) {
            views.setTextViewText(R.id.widget_progress, pathLabel + "  ·  Open your launch tracker");
        } else {
            views.setTextViewText(R.id.widget_progress, "Join in the Online Bar app to connect your referral progress");
        }

        Uri tracker = Uri.parse(BuildConfig.WAITLIST_SITE_URL);
        Intent openIntent = new Intent(context, MainActivity.class).setData(tracker);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                widgetId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        views.setOnClickPendingIntent(R.id.widget_open, pendingIntent);
        manager.updateAppWidget(widgetId, views);
    }
}
