import AppKit
import ApplicationServices
import CoreGraphics
func output(_ value:[String:Any]) { if let data=try? JSONSerialization.data(withJSONObject:value,options:[.sortedKeys]),let text=String(data:data,encoding:.utf8){print(text)} }
func attr(_ element:AXUIElement,_ key:String)->CFTypeRef?{var value:CFTypeRef?;if AXUIElementCopyAttributeValue(element,key as CFString,&value) == .success{return value};return nil}
func describe(_ element:AXUIElement)->String {
 let role=attr(element,kAXRoleAttribute) as? String ?? ""
 let title=attr(element,kAXTitleAttribute) as? String ?? attr(element,kAXDescriptionAttribute) as? String ?? ""
 let value=attr(element,kAXValueAttribute) as? String ?? ""
 let secure=role=="AXTextField" && (attr(element,kAXSubroleAttribute) as? String)=="AXSecureTextField"
 return "\(role) \(title.prefix(180)) \(secure ? "[secure]" : String(value.prefix(350)))"
}
func tree(_ root:AXUIElement)->[(AXUIElement,String)] {
 var result:[(AXUIElement,String)]=[]
 func walk(_ node:AXUIElement,_ depth:Int){if depth>14 || result.count>=250{return};let line=describe(node);result.append((node,line));if let children=attr(node,kAXChildrenAttribute) as? [AXUIElement]{for child in children{walk(child,depth+1)}}}
 walk(root,0);return result
}
func main() throws {
 let data=FileHandle.standardInput.readDataToEndOfFile();let request=(try JSONSerialization.jsonObject(with:data)) as? [String:Any] ?? [:]
 let action=request["action"] as? String ?? "status"
 if action=="status"{output(["accessibility":AXIsProcessTrusted(),"screenRecording":CGPreflightScreenCaptureAccess()]);return}
 if action=="request_permissions"{let granted=AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String:true] as CFDictionary);output(["accessibility":granted]);return}
 if action=="apps"{output(["apps":NSWorkspace.shared.runningApplications.filter{$0.activationPolicy == .regular}.compactMap{app->[String:Any]? in guard let bundle=app.bundleIdentifier else{return nil};return ["name":app.localizedName ?? bundle,"bundle":bundle]}]);return}
 guard AXIsProcessTrusted() else{throw NSError(domain:"ChatLocal",code:1,userInfo:[NSLocalizedDescriptionKey:"Chưa có quyền Trợ năng cho Chat Local Helper."])}
 guard let bundle=request["bundle"] as? String,let app=NSRunningApplication.runningApplications(withBundleIdentifier:bundle).first else{throw NSError(domain:"ChatLocal",code:2,userInfo:[NSLocalizedDescriptionKey:"Ứng dụng đã đóng. Hãy mở ứng dụng và chọn lại."])}
 let root=AXUIElementCreateApplication(app.processIdentifier);AXUIElementSetMessagingTimeout(root,2)
 let elements=tree(root)
 if action=="observe"{output(["app":app.localizedName ?? bundle,"bundle":bundle,"elements":elements.enumerated().map{index,item in ["id":index,"description":item.1]}]);return}
 // A browser user must approve each action before the server calls this helper.
 guard request["approved"] as? Bool == true else{throw NSError(domain:"ChatLocal",code:3,userInfo:[NSLocalizedDescriptionKey:"Thao tác chưa được xác nhận."])}
 app.activate(options:[]);Thread.sleep(forTimeInterval:0.25)
 guard NSWorkspace.shared.frontmostApplication?.processIdentifier==app.processIdentifier else{throw NSError(domain:"ChatLocal",code:4,userInfo:[NSLocalizedDescriptionKey:"Không chuyển được sang ứng dụng đã chọn."])}
 if action=="click" {
  guard let id=request["element"] as? Int,id>=0,id<elements.count,let expected=request["expected"] as? String,elements[id].1==expected else{throw NSError(domain:"ChatLocal",code:5,userInfo:[NSLocalizedDescriptionKey:"Màn hình đã đổi. Hãy quan sát lại."])}
  let element=elements[id].0
  if AXUIElementPerformAction(element,kAXPressAction as CFString) != .success {
   guard let pos=attr(element,kAXPositionAttribute),let size=attr(element,kAXSizeAttribute) else{throw NSError(domain:"ChatLocal",code:6,userInfo:[NSLocalizedDescriptionKey:"Không bấm được phần tử này."])}
   var point=CGPoint.zero;var dimensions=CGSize.zero
   AXValueGetValue(pos as! AXValue,.cgPoint,&point);AXValueGetValue(size as! AXValue,.cgSize,&dimensions)
   let center=CGPoint(x:point.x+dimensions.width/2,y:point.y+dimensions.height/2)
   CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:center,mouseButton:.left)?.post(tap:.cghidEventTap)
   CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:center,mouseButton:.left)?.post(tap:.cghidEventTap)
  }
 }else if action=="type" {
  let text=request["text"] as? String ?? "";guard text.count<=5000 else{throw NSError(domain:"ChatLocal",code:7)}
  let chars=Array(text.utf16);let event=CGEvent(keyboardEventSource:nil,virtualKey:0,keyDown:true);event?.keyboardSetUnicodeString(stringLength:chars.count,unicodeString:chars);event?.post(tap:.cghidEventTap)
 }else if action=="key" {
  let keys:[String:CGKeyCode]=["enter":36,"tab":48,"escape":53,"backspace":51,"up":126,"down":125,"left":123,"right":124,"a":0,"c":8,"v":9,"z":6,"l":37]
  guard let key=request["key"] as? String,let code=keys[key] else{throw NSError(domain:"ChatLocal",code:8)}
  var flags=CGEventFlags();if request["command"] as? Bool == true{flags.insert(.maskCommand)};if request["shift"] as? Bool == true{flags.insert(.maskShift)}
  for down in [true,false]{let event=CGEvent(keyboardEventSource:nil,virtualKey:code,keyDown:down);event?.flags=flags;event?.post(tap:.cghidEventTap)}
 }else if action=="scroll" {let amount=max(-800,min(800,request["amount"] as? Int ?? -300));CGEvent(scrollWheelEvent2Source:nil,units:.pixel,wheelCount:1,wheel1:Int32(amount),wheel2:0,wheel3:0)?.post(tap:.cghidEventTap)
 }else{throw NSError(domain:"ChatLocal",code:9,userInfo:[NSLocalizedDescriptionKey:"Thao tác không được hỗ trợ."])}
 output(["ok":true])
}
do{try main()}catch{output(["error":error.localizedDescription]);exit(1)}
