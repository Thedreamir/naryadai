# Android: оболочка подготовлена, APK не готов

Capacitor 8.5.3 (MIT), appId dev.tekton.syntheticdemo, appName Tekton OS Demo, webDir dist. Сначала npm ci / npm run build, затем npx cap sync android. Никакого отдельного backend: те же Supabase URL/Auth/RLS. Без VITE_SUPABASE_URL и публичного anon-key сборка не является рабочим демо. Сервисный ключ не добавлять.

Платформа android создана локально. Требуется JDK и Android SDK для сборки. Физический Android не проверен. Не выдавать scaffold за APK.

Push/Firebase не подключены. Экран поверх блокировки не обещаем: Android 14+ ограничивает full-screen intent; автоматическое право для calling/alarm core apps, а не нарядов. Нужны отдельные разрешения и реальная проверка поведения/политик. Пока только открытое приложение, обычный баннер/звук.

Источники: https://capacitorjs.com/docs/android ; https://capacitorjs.com/docs/getting-started/environment-setup ; https://developer.android.com/about/versions/14/behavior-changes-14 ; https://support.google.com/googleplay/android-developer/answer/13392821

Observed build failure 8 Oct: Android Gradle plugin requires Java 17; installed Java 11. SDK not found under standard /opt or /home paths. No APK produced. Run `node scripts/android-bootstrap.mjs` to recreate/sync generated platform after installing dependencies; then use Android Studio / `cd android && ./gradlew assembleDebug` on a build-capable machine. Compile/target SDK 36, min SDK 24 from Capacitor template.
