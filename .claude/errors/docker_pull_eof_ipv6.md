# docker pull échoue en boucle : `failed to copy: httpReadSeeker ... EOF`

## Symptôme

`docker compose up -d` / `docker pull` échoue systématiquement pendant le téléchargement des layers :

```
failed to copy: httpReadSeeker: failed open: failed to do request:
Get "https://production.cloudfront.docker.com/...": EOF
```

L'auth et les manifests passent (petites requêtes), seuls les gros téléchargements échouent. Les mirrors (ECR Public) échouent pareil — point commun : CloudFront.

## Diagnostic (rencontré le 2026-07-26, réseau Freebox)

```bash
curl.exe -4 -s -o NUL -w "IPv4: HTTP %{http_code}\n" https://production.cloudfront.docker.com/
curl.exe -6 -s -o NUL -w "IPv6: HTTP %{http_code}\n" https://production.cloudfront.docker.com/
```

Résultat : IPv4 → `403` (TLS OK, réponse normale sans signature) ; IPv6 → `000` (reset pendant le handshake).
**Cause : route IPv6 cassée vers CloudFront** (côté FAI/peering). Windows préfère IPv6 → Docker part sur la route morte.

## Solution

Au choix, du moins au plus invasif :
1. Redémarrer la box (resynchronise parfois l'IPv6)
2. Désactiver IPv6 sur la carte réseau Windows (Propriétés de la carte → décocher « Protocole Internet version 6 ») — réversible
3. Partage de connexion 4G le temps du pull (les images restent en cache ensuite)
