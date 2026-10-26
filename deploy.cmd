@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo [1/3] Vercel 프로젝트 연결
call npx -y vercel@latest link --yes --project wired-partner-catalog || goto :err

echo.
echo [2/3] 관리자 비밀번호 설정 (이미 설정했다면 그냥 엔터)
set "AP="
set /p "AP=관리자 페이지 비밀번호를 정해서 입력하세요: "
if not "%AP%"=="" (
  node -e "process.stdout.write(process.env.AP)" | npx -y vercel@latest env add ADMIN_PASSWORD production
)
set "AP="

echo.
echo [+] 슬랙 알림 Webhook 주소 (이미 설정했거나 아직 없으면 그냥 엔터)
set "SW="
set /p "SW=Slack Webhook URL: "
if not "%SW%"=="" (
  node -e "process.stdout.write(process.env.SW)" | npx -y vercel@latest env add SLACK_WEBHOOK_URL production
)
set "SW="

echo.
echo [3/3] 배포 (2~3분 걸려요)
call npx -y vercel@latest --prod --yes || goto :err
echo.
echo 완료! 위에 나온 Production 주소를 Claude에게 알려주세요.
pause
exit /b 0

:err
echo.
echo 오류가 발생했어요. 이 창의 내용을 캡처해서 Claude에게 보내주세요.
pause
exit /b 1
