$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$code = @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Speech.Recognition;
public static class SovereignDictation {
  public static string Transcribe(byte[] audio) {
    RecognizerInfo chosen = null;
    foreach (var info in SpeechRecognitionEngine.InstalledRecognizers()) {
      if (info.Culture.TwoLetterISOLanguageName == "en") chosen = info;
      if (info.Culture.Name == "en-US") break;
    }
    if (chosen == null) throw new InvalidOperationException("An English Windows speech recognizer is not installed.");
    using (var engine = new SpeechRecognitionEngine(chosen))
    using (var memory = new MemoryStream(audio)) {
      var parts = new List<string>();
      // Explicit court controls have a small vocabulary; keep dictation loaded
      // for free-form instructions rather than relying on it to learn names.
      var phrases = new List<string>();
      var actions = new List<string> { "open your head", "close your head", "open your brain", "close your brain" };
      foreach (var provider in new [] { "Muse", "ChatGPT", "Claude" }) {
        actions.Add("change your brain to " + provider);
        actions.Add("switch your brain to " + provider);
      }
      foreach (var action in actions) foreach (var prefix in new [] { "", "Elara ", "Bram ", "Iris ", "please " }) phrases.Add(prefix + action);
      var builder = new GrammarBuilder(new Choices(phrases.ToArray())); builder.Culture = chosen.Culture;
      var controls = new Grammar(builder) { Name = "court-controls", Priority = 100 };
      engine.LoadGrammar(controls);
      engine.LoadGrammar(new DictationGrammar());
      engine.SetInputToWaveStream(memory);
      // Read results synchronously: this worker has no desktop message pump.
      // Its owning Node process enforces a 30-second execution timeout.
      for (int i = 0; i < 64; i++) {
        var result = engine.Recognize(); if (result == null) break;
        if (result.Confidence > (result.Grammar.Name == "court-controls" ? 0.5 : 0.15)) parts.Add(result.Text);
      }
      return String.Join(" ", parts.ToArray());
    }
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies ([System.Speech.Recognition.SpeechRecognitionEngine].Assembly.Location)
$text = [SovereignDictation]::Transcribe([Convert]::FromBase64String([string]$request.audio))
[Console]::Out.Write((@{ transcript = $text } | ConvertTo-Json -Compress))
