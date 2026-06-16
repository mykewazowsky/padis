@echo off
chcp 65001 > nul
title PADIS Pipeline [flood] [full]
cd /d "D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend"
"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\venv\Scripts\python.exe" -u "D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\scripts\main.py" --mode full --hazard flood --operator Andhika_Prasetya
echo.
echo Pipeline selesai. Tekan sembarang tombol untuk menutup...
pause > nul
