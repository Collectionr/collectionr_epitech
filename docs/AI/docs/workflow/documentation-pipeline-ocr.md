# Documentation - Pipeline OCR (Notebook + Backend)

## But du document

Ce document explique deux choses :
1. Les outils utilisés pour le post-processing du OCR dans le notebook (Google Colab / Jupyter)
2. Comment le modèle exporté (format HuggingFace ou ONNX) est ensuite appelé depuis un backend FastAPI

---

## Partie 1 - Post-processing dans le notebook (Google Colab / Jupyter)

Dans cette partie, on va tester de scanner différentes cartes, puis faire un benchmark de chaque modèle en respectant la documentation du benchmark.

---

## Partie 2 - Export du modèle et utilisation dans un backend FastAPI

Une fois que le modèle OCR fonctionne bien dans le notebook, on l'exporte dans un fichier pour pouvoir l'utiliser ailleurs, par exemple dans un backend.

### 2.1 Bibliothèques nécessaires

| Bibliothèque | Rôle |
|---|---|
| `torch` | Runtime pour les modèles PyTorch (YOLOv10, Florence-2, Qwen2.5-VL, olmOCR) |
| `transformers` | Chargement des modèles HuggingFace (Florence-2, Qwen2.5-VL, olmOCR) |
| `onnxruntime` | Inférence depuis un export ONNX (format universel) |
| `fastapi` | Créer le backend et les routes |
| `pillow` | Lire et préparer l'image envoyée au backend |

Installation :

```bash
pip install torch transformers onnxruntime fastapi pillow
```

### 2.2 Export du modèle

Les modèles évalués (Florence-2, Qwen2.5-VL, olmOCR) se sauvegardent au format HuggingFace ou ONNX :

```python
# HuggingFace (Florence-2, Qwen2.5-VL, olmOCR)
model.save_pretrained("./ocr_model")
processor.save_pretrained("./ocr_model")

# Export ONNX (format universel, compatible TorchScript, TensorRT…)
import torch
torch.onnx.export(model, dummy_input, "ocr_model.onnx")
```

Ça crée un dossier `ocr_model/` (HuggingFace) ou un fichier `ocr_model.onnx` qu'on peut ensuite charger dans le backend sans avoir besoin du notebook.

### 2.3 Utilisation dans FastAPI

Dans le backend, on charge ce fichier une seule fois au démarrage, puis on l'utilise dans des routes (endpoints).

```python
from fastapi import FastAPI, UploadFile
from transformers import AutoProcessor, AutoModel

app = FastAPI()
processor = AutoProcessor.from_pretrained("./ocr_model")
model = AutoModel.from_pretrained("./ocr_model")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
async def predict(file: UploadFile):
    image = await file.read()
    # preprocessing + appel du modèle ici
    text = "résultat OCR ici"
    return {"text": text}
```

### 2.4 Lancer le serveur en local

```bash
uvicorn main:app --reload
```

Le serveur démarre en local, généralement sur :

```
http://127.0.0.1:8000
```

### 2.5 Tester les routes (GET, POST...) avec la doc automatique

FastAPI génère automatiquement une page de documentation interactive. Pas besoin de Postman pour tester.

- Doc interactive (Swagger UI) : `http://127.0.0.1:8000/docs`
- Doc alternative (Redoc) : `http://127.0.0.1:8000/redoc`

Sur la page `/docs`, on voit toutes les routes disponibles (`GET /health`, `POST /predict`, etc.). On peut cliquer sur une route, remplir les champs (par exemple uploader une image pour `/predict`), cliquer sur "Execute", et voir directement la réponse du backend.

---

## Résumé

- Le **post-processing** consiste à scanner différentes cartes et faire un benchmark de chaque modèle selon la documentation du benchmark
- Le **modèle** est ensuite sauvegardé au format HuggingFace (`save_pretrained`) ou ONNX (`.onnx`)
- Le **backend FastAPI** charge ce fichier et expose des routes (`GET`, `POST`) pour l'utiliser
- La doc `/docs` permet de tester les routes directement dans le navigateur, en local
