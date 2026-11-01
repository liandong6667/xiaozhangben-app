package com.xiaozhangben.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * 把下好的 APK 递给系统安装器读。
 *
 * 为什么不直接给 file:// —— Android 7 起禁止把一个文件路径直接交给别的应用
 * （会抛 FileUriExposed），必须走 content:// 并且临时授权。
 * 官方做法是 androidx 的 FileProvider，但本项目是手打构建、没有 support 库，
 * 所以这里写一个最小的：只认 cache/upd 目录下的 .apk，只读，别的路径一律给不了。
 */
public class ApkProvider extends ContentProvider {

    public static final String AUTHORITY = "com.xiaozhangben.app.apk";

    public static Uri uriFor(File f) {
        return Uri.parse("content://" + AUTHORITY + "/" + f.getName());
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    private File resolve(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null) throw new FileNotFoundException("空路径");
        // 只放行纯文件名，挡住 ../ 之类的越界读
        if (name.indexOf('/') >= 0 || name.indexOf("..") >= 0) throw new FileNotFoundException(name);
        Context c = getContext();
        if (c == null) throw new FileNotFoundException("没有上下文");
        File f = new File(new File(c.getCacheDir(), "upd"), name);
        if (!f.exists()) throw new FileNotFoundException(name);
        return f;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = resolve(uri);
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    /** 让系统安装器能读到文件名和大小（不实现也不影响安装，实现了显示更正常） */
    @Override
    public Cursor query(Uri uri, String[] projection, String sel, String[] selArgs, String sort) {
        try {
            File f = resolve(uri);
            String[] cols = projection != null ? projection
                    : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
            MatrixCursor cur = new MatrixCursor(cols, 1);
            Object[] row = new Object[cols.length];
            for (int i = 0; i < cols.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = f.getName();
                else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
                else row[i] = null;
            }
            cur.addRow(row);
            return cur;
        } catch (Throwable t) {
            return null;
        }
    }

    @Override
    public Uri insert(Uri uri, ContentValues v) {
        return null;
    }

    @Override
    public int delete(Uri uri, String s, String[] a) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues v, String s, String[] a) {
        return 0;
    }
}
