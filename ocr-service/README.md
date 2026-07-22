# Mercatura Face & OCR API

FastAPI service that powers the `FaceCapture` and `EgyptianIDScanner` components.
Runs on **`localhost:5050`** (matches the frontend's `VITE_OCR_API_URL` default).

---

## Requirements

- Python 3.10+
- ~4 GB disk for model weights (ArcFace + RetinaFace + EasyOCR Arabic)
- macOS / Linux (Windows works but OpenCV headless may need adjustment)

---

## Setup

```bash
cd face_api

# Create virtualenv
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (First run only) DeepFace downloads ArcFace + RetinaFace weights automatically.
# EasyOCR downloads Arabic + English CRAFT models automatically.
# Both are cached in ~/.deepface/ and ~/.EasyOCR/ respectively.
```

---

## Running

```bash
uvicorn main:app --port 5050 --reload
```

Health check → `GET http://localhost:5050/health`

---

## API

### `POST /face/register`

Register an employee's face.

| Field | Type | Description |
|-------|------|-------------|
| `image` | file | JPEG/PNG face photo |
| `employee_id` | string | Unique employee key (used as storage key) |

**Response**
```json
{ "success": true }
```
or HTTP 422 `{ "error": "No face detected…" }`

Embeddings are stored as `faces/<employee_id>.json` (cosine-comparable ArcFace vectors).

---

### `POST /face/verify`

Verify a live photo against a registered embedding.

| Field | Type | Description |
|-------|------|-------------|
| `image` | file | JPEG/PNG face photo |
| `employee_id` | string | Must match a registered employee |

**Response**
```json
{ "match": true,  "no_face": false }
{ "match": false, "no_face": false }   // face found but doesn't match
{ "match": false, "no_face": true  }   // no face detected in image
```

The match threshold is cosine distance < **0.40** (ArcFace scale). Tighten it in
`COSINE_THRESHOLD` if you get false positives in your environment.

---

### `POST /ocr`

Extract fields from an Egyptian National ID card (front face).

| Field | Type | Description |
|-------|------|-------------|
| `image` | file | Photo of ID card (JPEG/PNG/WEBP) |

**Response**
```json
{
  "first_name":   "محمد",
  "second_name":  "وائل",
  "full_name":    "محمد وائل إبراهيم",
  "national_id":  "29901011234567",
  "address":      "شارع التحرير، الدقي",
  "birth_date":   "01/01/1999",
  "governorate":  "Giza",
  "gender":       "Male"
}
```

**How it works**

1. EasyOCR extracts all text (Arabic + English) from the ID image.
2. The 14-digit national ID number is found via regex — this is the most reliable
   field because OCR handles digits well.
3. Birth date, gender (odd serial = Male), and governorate are derived from the
   ID number's encoded structure — so these fields are accurate even when OCR
   quality is low.
4. Name and address are extracted with heuristics on the Arabic text lines.

---

## Tuning

| Variable | Default | Notes |
|----------|---------|-------|
| `FACE_MODEL` | `ArcFace` | Also supports `Facenet512`, `VGG-Face` |
| `FACE_DETECTOR` | `retinaface` | Fastest alternative: `mtcnn` |
| `COSINE_THRESHOLD` | `0.40` | Lower = stricter. Try `0.35` for extra security |

---

## File layout

```
face_api/
  main.py           ← FastAPI app
  requirements.txt
  README.md
  faces/            ← created at runtime; one JSON per registered employee
```
