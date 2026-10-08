!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!define MUI_BGCOLOR "111213"
!define MUI_TEXTCOLOR "E4E6E9"
!define MUI_INSTFILESPAGE_COLORS "E4E6E9 111213"
!define MUI_HEADER_TRANSPARENT_TEXT
!define MUI_ABORTWARNING
!define MUI_DIRECTORYPAGE_TEXT_TOP "Выберите папку для Kernel. Аккаунты, вкладки и настройки хранятся отдельно и сохраняются при обновлении."

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!ifndef BUILD_UNINSTALLER
Var KernelDialog
Var KernelLabel
Var KernelTitleFont
Var KernelBodyFont
Var KernelLaunch
!define MUI_CUSTOMFUNCTION_GUIINIT KernelGUIInit

Function KernelGUIInit
  SetCtlColors $HWNDPARENT E4E6E9 111213
  GetDlgItem $0 $HWNDPARENT 1028
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1256
  ShowWindow $0 ${SW_HIDE}
  CreateFont $KernelTitleFont "Segoe UI" 25 500
  CreateFont $KernelBodyFont "Segoe UI" 10 400
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
FunctionEnd

!macro KernelLabel X Y W H TEXT
  ${NSD_CreateLabel} ${X} ${Y} ${W} ${H} "${TEXT}"
  Pop $KernelLabel
  SetCtlColors $KernelLabel E4E6E9 111213
  SendMessage $KernelLabel ${WM_SETFONT} $KernelBodyFont 1
!macroend

!macro customWelcomePage
  Page custom KernelWelcome
!macroend

Function KernelWelcome
  !insertmacro MUI_HEADER_TEXT "Kernel" "Установка браузера"
  nsDialogs::Create 1018
  Pop $KernelDialog
  SetCtlColors $KernelDialog E4E6E9 111213
  !insertmacro KernelLabel 10u 12u 280u 42u "Kernel"
  SendMessage $KernelLabel ${WM_SETFONT} $KernelTitleFont 1
  !insertmacro KernelLabel 12u 52u 280u 18u "Браузер для рабочего стола."
  !insertmacro KernelLabel 12u 80u 280u 32u "Вкладки слева, локальный чат и инструменты для работы со страницами - справа."
  !insertmacro KernelLabel 12u 124u 280u 26u "${VERSION}  /  Windows x64$\r$\nУстановка для текущего пользователя."
  SetCtlColors $KernelLabel 969BA3 111213
  nsDialogs::Show
FunctionEnd

!macro customFinishPage
  Page custom KernelFinish KernelFinishLeave
!macroend

Function KernelFinish
  !insertmacro MUI_HEADER_TEXT "Kernel установлен" "Можно начинать работу"
  nsDialogs::Create 1018
  Pop $KernelDialog
  SetCtlColors $KernelDialog E4E6E9 111213
  !insertmacro KernelLabel 10u 12u 280u 42u "Готово."
  SendMessage $KernelLabel ${WM_SETFONT} $KernelTitleFont 1
  !insertmacro KernelLabel 12u 54u 280u 32u "Ярлык Kernel добавлен на рабочий стол и в меню «Пуск». Существующий профиль сохранён."
  !insertmacro KernelLabel 12u 95u 280u 28u "Модель чата загружается отдельно при первом использовании - около 7,5 ГБ."
  SetCtlColors $KernelLabel 969BA3 111213
  ${NSD_CreateCheckbox} 12u 132u 270u 15u "Открыть Kernel"
  Pop $KernelLaunch
  SetCtlColors $KernelLaunch E4E6E9 111213
  SendMessage $KernelLaunch ${WM_SETFONT} $KernelBodyFont 1
  ${NSD_Check} $KernelLaunch
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Готово"
  GetDlgItem $0 $HWNDPARENT 3
  EnableWindow $0 0
  GetDlgItem $0 $HWNDPARENT 2
  EnableWindow $0 0
  nsDialogs::Show
FunctionEnd

Function KernelFinishLeave
  ${NSD_GetState} $KernelLaunch $0
  ${If} $0 == ${BST_CHECKED}
    ExecShell "open" "$INSTDIR\Kernel.exe"
  ${EndIf}
FunctionEnd
!endif

!macro customInstall
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Kernel" "" "Kernel"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Kernel\DefaultIcon" "" "$INSTDIR\Kernel.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Kernel\shell\open\command" "" '$\"$INSTDIR\Kernel.exe$\"'
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Kernel\Capabilities" "ApplicationName" "Kernel"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Kernel\Capabilities" "ApplicationDescription" "Браузер Kernel"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Kernel\Capabilities\URLAssociations" "http" "KernelBrowser.URL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Kernel\Capabilities\URLAssociations" "https" "KernelBrowser.URL"
  WriteRegStr HKCU "Software\RegisteredApplications" "Kernel" "Software\Clients\StartMenuInternet\Kernel\Capabilities"
  WriteRegStr HKCU "Software\Classes\KernelBrowser.URL" "" "Kernel URL"
  WriteRegStr HKCU "Software\Classes\KernelBrowser.URL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\KernelBrowser.URL\DefaultIcon" "" "$INSTDIR\Kernel.exe,0"
  WriteRegStr HKCU "Software\Classes\KernelBrowser.URL\shell\open\command" "" '$\"$INSTDIR\Kernel.exe$\" $\"%1$\"'
!macroend

!macro customUnInstall
  ReadRegStr $0 HKCU "Software\Clients\StartMenuInternet\Kernel\DefaultIcon" ""
  ${If} $0 == "$INSTDIR\Kernel.exe,0"
    DeleteRegValue HKCU "Software\RegisteredApplications" "Kernel"
    DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Kernel"
    DeleteRegKey HKCU "Software\Classes\KernelBrowser.URL"
  ${EndIf}
!macroend

