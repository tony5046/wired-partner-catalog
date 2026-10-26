@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === 와이어드 상품 카탈로그 코드를 GitHub에 올립니다 ===
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [!] Git이 없어요. 설치 후 이 창을 닫고 다시 실행해 주세요.
  echo     winget install --id Git.Git -e
  echo     또는 https://git-scm.com/download/win
  pause
  exit /b 1
)
where gh >nul 2>nul
if errorlevel 1 (
  echo [!] GitHub CLI가 없어요. 설치 후 이 창을 닫고 다시 실행해 주세요.
  echo     winget install --id GitHub.cli -e
  echo     또는 https://cli.github.com
  pause
  exit /b 1
)

gh auth status >nul 2>nul
if errorlevel 1 (
  echo GitHub 로그인 창이 열려요. 브라우저에서 승인해 주세요.
  gh auth login --hostname github.com --git-protocol https --web
  if errorlevel 1 ( echo 로그인 실패 & pause & exit /b 1 )
)
gh auth setup-git >nul 2>nul

if not exist ".git" git init -b main >nul

git config user.name >nul 2>nul || git config user.name "SEOKHOJEONG"
git config user.email >nul 2>nul || git config user.email "tony@wired.company"

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -q -F github-commit-msg.txt
)

git remote get-url origin >nul 2>nul
if not errorlevel 1 goto push
set "REPO="
set /p REPO=저장소 이름 [Enter = wired-partner-catalog]: 
if "%REPO%"=="" set "REPO=wired-partner-catalog"
gh repo create "%REPO%" --private --source . --remote origin --push
goto done
:push
git push -u origin main
:done
if errorlevel 1 ( echo. & echo [!] 업로드 실패 - 위 메시지를 캡처해서 보내주세요. & pause & exit /b 1 )

echo.
echo === 완료! 아래 주소를 공유하세요 (비공개 저장소) ===
gh repo view --json url -q .url
echo 다른 사람이 보려면: 저장소 Settings ^> Collaborators 에서 GitHub 아이디로 초대
pause
