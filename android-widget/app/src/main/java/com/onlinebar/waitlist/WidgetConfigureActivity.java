package com.onlinebar.waitlist;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class WidgetConfigureActivity extends Activity {
    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private EditText memberTokenInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        appWidgetId = getIntent().getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
        );
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(24);
        content.setPadding(padding, padding, padding, padding);

        TextView title = new TextView(this);
        title.setText("Set up your launch widget");
        title.setTextSize(20);
        content.addView(title);

        TextView instructions = new TextView(this);
        instructions.setText("Join through this app to connect your private dashboard token automatically. You can also enter the 43-character member token from your signup response.");
        instructions.setTextSize(14);
        LinearLayout.LayoutParams instructionsParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        instructionsParams.topMargin = dp(12);
        content.addView(instructions, instructionsParams);

        memberTokenInput = new EditText(this);
        memberTokenInput.setSingleLine(true);
        memberTokenInput.setHint("Private member token");
        memberTokenInput.setInputType(0x00000001);
        String savedToken = getSharedPreferences(WaitlistWidgetProvider.PREFERENCES, MODE_PRIVATE)
                .getString(WaitlistWidgetProvider.MEMBER_TOKEN, "");
        memberTokenInput.setText(savedToken);
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        inputParams.topMargin = dp(14);
        content.addView(memberTokenInput, inputParams);

        Button save = new Button(this);
        save.setText("SAVE WIDGET");
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        buttonParams.topMargin = dp(12);
        content.addView(save, buttonParams);
        save.setOnClickListener(view -> saveWidget());

        setContentView(content);
    }

    private void saveWidget() {
        String token = memberTokenInput.getText().toString().trim();
        if (!token.isEmpty() && !token.matches("[A-Za-z0-9_-]{43}")) {
            memberTokenInput.setError("Enter a valid 43-character member token.");
            return;
        }
        if (!token.isEmpty()) {
            getSharedPreferences(WaitlistWidgetProvider.PREFERENCES, MODE_PRIVATE)
                    .edit()
                    .putString(WaitlistWidgetProvider.MEMBER_TOKEN, token)
                    .apply();
        } else {
            getSharedPreferences(WaitlistWidgetProvider.PREFERENCES, MODE_PRIVATE)
                    .edit()
                    .remove(WaitlistWidgetProvider.MEMBER_TOKEN)
                    .apply();
        }
        Intent result = new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        setResult(RESULT_OK, result);
        WaitlistWidgetProvider.requestRefresh(this);
        finish();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
