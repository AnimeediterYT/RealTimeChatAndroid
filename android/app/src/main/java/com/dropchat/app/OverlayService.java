package com.dropchat.app;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class OverlayService extends Service {
  private WindowManager windowManager;
  private View bubble;
  private View panel;
  private WindowManager.LayoutParams bubbleParams;
  private WindowManager.LayoutParams panelParams;

  private int overlayType() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      : WindowManager.LayoutParams.TYPE_PHONE;
  }

  private GradientDrawable background(int color, float radius) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setColor(color);
    drawable.setCornerRadius(radius);
    return drawable;
  }

  @Override public void onCreate() {
    super.onCreate();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) { stopSelf(); return; }
    windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    createBubble();
  }

  private void createBubble() {
    TextView view = new TextView(this);
    view.setText("●");
    view.setTextSize(22);
    view.setTextColor(Color.WHITE);
    view.setGravity(Gravity.CENTER);
    view.setBackground(background(Color.rgb(91, 76, 220), 100));
    bubble = view;
    bubbleParams = new WindowManager.LayoutParams(68, 68, overlayType(), WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
    bubbleParams.gravity = Gravity.TOP | Gravity.END;
    bubbleParams.x = 24;
    bubbleParams.y = 220;
    attachDrag(view, bubbleParams, true);
    windowManager.addView(bubble, bubbleParams);
  }

  private void attachDrag(View view, WindowManager.LayoutParams params, boolean opensPanel) {
    view.setOnTouchListener(new View.OnTouchListener() {
      float downX, downY;
      int startX, startY;
      public boolean onTouch(View v, MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
          downX = event.getRawX(); downY = event.getRawY(); startX = params.x; startY = params.y; return true;
        }
        if (event.getAction() == MotionEvent.ACTION_MOVE) {
          params.x = startX + (int) (downX - event.getRawX());
          params.y = startY + (int) (event.getRawY() - downY);
          windowManager.updateViewLayout(v, params); return true;
        }
        if (event.getAction() == MotionEvent.ACTION_UP && Math.abs(event.getRawX() - downX) < 12 && Math.abs(event.getRawY() - downY) < 12) {
          if (opensPanel) showPanel(); else openApp();
          return true;
        }
        return true;
      }
    });
  }

  private void showPanel() {
    if (panel != null) return;
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(28, 24, 28, 22);
    card.setBackground(background(Color.rgb(12, 20, 48), 34));

    TextView title = new TextView(this);
    title.setText("dropchat");
    title.setTextColor(Color.WHITE);
    title.setTextSize(18);
    title.setTypeface(null, 1);
    card.addView(title, new LinearLayout.LayoutParams(-1, 50));

    TextView status = new TextView(this);
    status.setText("Floating chat is ready");
    status.setTextColor(Color.LTGRAY);
    status.setTextSize(13);
    card.addView(status, new LinearLayout.LayoutParams(-1, 54));

    Button open = new Button(this);
    open.setText("Open chat");
    open.setTextColor(Color.WHITE);
    open.setBackground(background(Color.rgb(91, 76, 220), 22));
    open.setOnClickListener(v -> openApp());
    card.addView(open, new LinearLayout.LayoutParams(-1, 52));

    TextView close = new TextView(this);
    close.setText("Close floating bubble");
    close.setTextColor(Color.LTGRAY);
    close.setGravity(Gravity.CENTER);
    close.setPadding(0, 18, 0, 0);
    close.setOnClickListener(v -> stopSelf());
    card.addView(close, new LinearLayout.LayoutParams(-1, 52));

    panel = card;
    panelParams = new WindowManager.LayoutParams(310, 240, overlayType(), WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
    panelParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
    panelParams.y = 180;
    attachDrag(card, panelParams, false);
    windowManager.addView(panel, panelParams);
  }

  private void openApp() {
    Intent intent = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    startActivity(intent);
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }

  @Override public void onDestroy() {
    if (panel != null && windowManager != null) windowManager.removeView(panel);
    if (bubble != null && windowManager != null) windowManager.removeView(bubble);
    super.onDestroy();
  }

  @Override public IBinder onBind(Intent intent) { return null; }
}
