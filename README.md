# مصاريفي — React Native (Expo)

## الحصول على APK بدون كمبيوتر (GitHub Actions)
1. ارفع هذا المجلد كـ repository على GitHub (فرع `main`).
2. البناء بيشتغل تلقائياً على سيرفرات GitHub (حوالي 15 دقيقة).
3. من صفحة الـ repo على الجوال: Releases ← آخر نسخة ← نزّل `app-release.apk` وثبّته.

الملف المسؤول: `.github/workflows/android-apk.yml`.

## التشغيل للتطوير
```bash
npm install
npx expo start
```

## البنية
- `src/theme.ts` الألوان والخط (IBM Plex Sans Arabic)
- `src/ui.tsx` العناصر المشتركة
- `src/analysis.ts` منطق التحليل والتنبيهات
- `src/store.tsx` البيانات والحفظ المحلي (لاحقاً Supabase)
- `src/components/` الهيرو، الشارتات، شاشة إضافة المصروف، التصنيف
- `src/screens/` الرئيسية، المصاريف، التحليل، التصنيفات
