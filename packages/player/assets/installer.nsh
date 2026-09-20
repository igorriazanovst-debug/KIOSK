; packages/player/assets/installer.nsh
;
; Migration away from the shared install folder.
;
; Every KIOSK app used to install into one folder, "@kiosk-platformplayer"
; (see packages/server/src/utils/installIdentity.js for the cause), so apps
; overwrote each other. New installers default to a per-app folder, but NSIS
; prefers the InstallLocation already stored in the registry for this app.
; On a computer where the app was installed before, that value still points
; at the shared folder, and the new installer would go straight back into it.
;
; So: if the stored location IS the legacy shared folder, forget it and let
; the installer use its new per-app default. Any other stored location (the
; user picked a folder by hand) is left alone.
;
; The file is plain ASCII on purpose: makensis reads it without a BOM.

; InstallLocation may or may not carry a trailing backslash depending on the
; electron-builder version, so both spellings are checked (21 and 22 chars).

!macro kioskForgetLegacyDir ROOT
  ReadRegStr $0 ${ROOT} "${INSTALL_REGISTRY_KEY}" InstallLocation
  StrCpy $1 $0 "" -21
  StrCmp $1 "@kiosk-platformplayer" kioskLegacy_${ROOT} 0
  StrCpy $1 $0 "" -22
  StrCmp $1 "@kiosk-platformplayer\" kioskLegacy_${ROOT} kioskKeep_${ROOT}
  kioskLegacy_${ROOT}:
    DeleteRegValue ${ROOT} "${INSTALL_REGISTRY_KEY}" InstallLocation
  kioskKeep_${ROOT}:
!macroend

!macro preInit
  Push $0
  Push $1
  !insertmacro kioskForgetLegacyDir HKCU
  !insertmacro kioskForgetLegacyDir HKLM
  Pop $1
  Pop $0
!macroend
