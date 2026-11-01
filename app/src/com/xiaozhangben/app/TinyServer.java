package com.xiaozhangben.app;

import android.content.Context;
import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;

/**
 * 一个极小的本机 HTTP 服务，只干一件事：把 assets/www 里的网页喂给 WebView。
 *
 * 为什么要这么绕？因为直接 file:// 加载时，浏览器安全策略会禁掉 Worker 和 wasm，
 * 截图记账的 OCR 引擎就跑不起来，而且 localStorage 也不稳。
 * 换成 http://127.0.0.1 就有了正常的 origin，网页里所有功能都能原样使用。
 */
public class TinyServer implements Runnable {

    private final AssetManager am;
    private final ServerSocket ss;
    private volatile boolean running = true;

    private TinyServer(Context ctx, int port) throws IOException {
        this.am = ctx.getAssets();
        this.ss = new ServerSocket(port, 24, InetAddress.getByName("127.0.0.1"));
    }

    public static int start(Context ctx) {
        int[] ports = {8765, 8766, 8767, 0};
        for (int p : ports) {
            try {
                TinyServer s = new TinyServer(ctx, p);
                Thread t = new Thread(s, "xzb-http");
                t.setDaemon(true);
                t.start();
                return s.ss.getLocalPort();
            } catch (IOException e) {
                // 端口被占，试下一个
            }
        }
        return -1;
    }

    public void run() {
        while (running) {
            try {
                Socket c = ss.accept();
                serve(c);
            } catch (IOException e) {
                if (!running) break;
            }
        }
    }

    private void serve(Socket c) {
        try {
            c.setSoTimeout(20000);
            InputStream in = c.getInputStream();

            ByteArrayOutputStream hb = new ByteArrayOutputStream();
            int cur;
            while ((cur = in.read()) != -1) {
                hb.write(cur);
                int n = hb.size();
                if (n >= 4) {
                    byte[] a = hb.toByteArray();
                    if (a[n - 4] == '\r' && a[n - 3] == '\n' && a[n - 2] == '\r' && a[n - 1] == '\n') break;
                }
                if (n > 20000) break;
            }

            String head = new String(hb.toByteArray(), "UTF-8");
            String path = "/index.html";
            try {
                String first = head.split("\r\n")[0];
                String[] parts = first.split(" ");
                if (parts.length >= 2) path = parts[1];
            } catch (Exception ignored) { }

            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);
            if (path.length() == 0 || path.equals("/")) path = "/index.html";
            if (path.startsWith("/")) path = path.substring(1);
            try { path = URLDecoder.decode(path, "UTF-8"); } catch (Exception ignored) { }

            byte[] data = read("www/" + path);
            if (data == null) data = read(path);

            OutputStream out = c.getOutputStream();
            if (data == null) {
                byte[] msg = ("找不到文件: " + path).getBytes("UTF-8");
                out.write(("HTTP/1.1 404 Not Found\r\nContent-Type: text/plain; charset=utf-8\r\n"
                        + "Content-Length: " + msg.length + "\r\nConnection: close\r\n\r\n").getBytes("UTF-8"));
                out.write(msg);
            } else {
                String h = "HTTP/1.1 200 OK\r\n"
                        + "Content-Type: " + mime(path) + "\r\n"
                        + "Content-Length: " + data.length + "\r\n"
                        + "Cache-Control: no-store\r\n"
                        + "Connection: close\r\n\r\n";
                out.write(h.getBytes("UTF-8"));
                out.write(data);
            }
            out.flush();
        } catch (Throwable ignored) {
            // 单次请求失败不影响服务
        } finally {
            try { c.close(); } catch (Exception ignored) { }
        }
    }

    private byte[] read(String path) {
        InputStream is = null;
        try {
            is = am.open(path);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int r;
            while ((r = is.read(buf)) > 0) bo.write(buf, 0, r);
            return bo.toByteArray();
        } catch (Exception e) {
            return null;
        } finally {
            try { if (is != null) is.close(); } catch (Exception ignored) { }
        }
    }

    private static String mime(String p) {
        String s = p.toLowerCase();
        if (s.endsWith(".html") || s.endsWith(".htm")) return "text/html; charset=utf-8";
        if (s.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (s.endsWith(".css")) return "text/css; charset=utf-8";
        if (s.endsWith(".json")) return "application/json; charset=utf-8";
        if (s.endsWith(".wasm")) return "application/wasm";
        if (s.endsWith(".gz")) return "application/gzip";
        if (s.endsWith(".png")) return "image/png";
        if (s.endsWith(".jpg") || s.endsWith(".jpeg")) return "image/jpeg";
        if (s.endsWith(".svg")) return "image/svg+xml";
        if (s.endsWith(".ico")) return "image/x-icon";
        if (s.endsWith(".csv")) return "text/csv; charset=utf-8";
        if (s.endsWith(".txt")) return "text/plain; charset=utf-8";
        return "application/octet-stream";
    }
}
