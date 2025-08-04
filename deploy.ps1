# deploy.ps1
git checkout main
git pull origin main

Remove-Item -Path ".\build" -Recurse -Force

npm install
npm run build:dev

git checkout dist

Copy-Item -Path "build\*" -Destination ".\dist" -Recurse -Force

git add .
git commit -m "Update build files - $(Get-Date -Format 'yyyyMMdd')"
git push

git checkout main
