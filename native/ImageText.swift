import Foundation
import Vision
import AppKit
let args=CommandLine.arguments
if args.count<2{exit(1)}
let url=URL(fileURLWithPath:args[1])
do{
 let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection=true
 try VNImageRequestHandler(url:url).perform([request])
 let text=(request.results ?? []).compactMap{$0.topCandidates(1).first?.string}.joined(separator:"\n")
 let result=try JSONSerialization.data(withJSONObject:["text":text]);print(String(data:result,encoding:.utf8)!)
}catch{print("{\"text\":\"\"}")}
