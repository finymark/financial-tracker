# Receipt OCR runs locally with Tesseract, without AI or cloud services

Receipt photos are read on the user's machine with Tesseract (plus image preprocessing), not with cloud OCR or vision LLMs, which were cheaper to build and more accurate on line items. The owners want no data leaving the machine and no API keys at this stage. The OCR sits behind a replaceable module boundary so Windows' built-in OCR or another engine can be swapped in if Tesseract proves too weak on real receipts.
