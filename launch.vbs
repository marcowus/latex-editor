Option Explicit
Dim WshShell, fso, scriptDir, http, i, isRunning, url, nodePath, serverPath, runCmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

url = "http://127.0.0.1:3000"

' Locate node.exe
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    nodePath = "C:\Program Files\nodejs\node.exe"
ElseIf fso.FileExists("C:\Program Files (x86)\nodejs\node.exe") Then
    nodePath = "C:\Program Files (x86)\nodejs\node.exe"
ElseIf fso.FileExists("C:\Users\wuyue\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe") Then
    nodePath = "C:\Users\wuyue\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
Else
    nodePath = "node"
End If

serverPath = scriptDir & "\dist\server.cjs"

' Check if service is already running
isRunning = False
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
If http Is Nothing Then Set http = CreateObject("MSXML2.ServerXMLHTTP")
If http Is Nothing Then Set http = CreateObject("Microsoft.XMLHTTP")

http.Open "GET", url & "/api/health", False
http.setTimeouts 500, 500, 500, 500
http.Send
If Err.Number = 0 And http.Status = 200 Then
    isRunning = True
End If
Err.Clear
On Error GoTo 0

If Not isRunning Then
    ' Set NODE_ENV to production
    Dim env
    Set env = WshShell.Environment("PROCESS")
    env("NODE_ENV") = "production"

    ' Start server hidden
    runCmd = """" & nodePath & """ """ & serverPath & """"
    WshShell.Run runCmd, 0, False

    ' Wait up to 8s for server ready
    For i = 1 To 40
        WScript.Sleep 200
        On Error Resume Next
        http.Open "GET", url & "/api/health", False
        http.setTimeouts 500, 500, 500, 500
        http.Send
        If Err.Number = 0 And http.Status = 200 Then
            Exit For
        End If
        Err.Clear
        On Error GoTo 0
    Next
End If

' Open default browser
WshShell.Run url
