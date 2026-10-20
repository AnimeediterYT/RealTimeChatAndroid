package com.dropchat.app;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

public class OverlayService extends Service {
  private WindowManager windowManager;
  private View bubble;
  private WindowManager.LayoutParams params;

  @Override public void onCreate() {
    super.onCreate();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) { stopSelf(); return; }
    windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    TextView view = new TextView(this);
    view.setText("◌");
    view.setTextSize(28);
    view.setTextColor(Color.WHITE);
    view.setGravity(Gravity.CENTER);
    view.setBackgroundColor(Color.rgb(91, 76, 220));
    bubble = view;
    int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
    params = new WindowManager.LayoutParams(64, 64, type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.END; params.x = 24; params.y = 220;
    view.setOnTouchListener(new View.OnTouchListener() { float downX, downY; int startX, startY;
      public boolean onTouch(View v, MotionEvent e) { if (e.getAction() == MotionEvent.ACTION_DOWN) { downX=e.getRawX(); downY=e.getRawY(); startX=params.x; startY=params.y; return true; }
        if (e.getAction() == MotionEvent.ACTION_MOVE) { params.x = startX + (int)(downX-e.getRawX()); params.y = startY + (int)(e.getRawY()-downY); windowManager.updateViewLayout(bubble, params); return true; }
        if (e.getAction() == MotionEvent.ACTION_UP && Math.abs(e.getRawX()-downX)<12 && Math.abs(e.getRawY()-downY)<12) { Intent i = new Intent(OverlayService.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); return true; } return true; }
    });
    windowManager.addView(bubble, params);
  }
  @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }
  @Override public void onDestroy() { if (bubble != null && windowManager != null) windowManager.removeView(bubble); super.onDestroy(); }
  @Override public IBinder onBind(Intent intent) { return null; }
}
