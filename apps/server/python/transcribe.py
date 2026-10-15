"""Local transcription with word timings (faster-whisper), run by the server as a child process.

    python transcribe.py <audio.wav> <out.json> <model> <language|auto>

Writes {"language": "pt", "words": [{"w": "Olá,", "s": 0.0, "e": 0.32}, ...]} and prints
"PROGRESS <0-1>" lines while it works. Nothing leaves the machine.
"""
import json
import sys


def main(wav, out, model, language):
    from faster_whisper import WhisperModel

    m = WhisperModel(model, device='cpu', compute_type='int8')
    segments, info = m.transcribe(
        wav,
        language=None if language == 'auto' else language,
        word_timestamps=True,
        vad_filter=True,
    )
    total = max(info.duration or 0.0, 0.1)
    words = []
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if text:
                words.append({'w': text, 's': round(w.start, 3), 'e': round(w.end, 3)})
        print(f'PROGRESS {min(1.0, seg.end / total):.3f}', flush=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'language': info.language, 'words': words}, f, ensure_ascii=False)


if __name__ == '__main__':
    if len(sys.argv) != 5:
        sys.exit('usage: transcribe.py <audio.wav> <out.json> <model> <language|auto>')
    main(*sys.argv[1:5])
