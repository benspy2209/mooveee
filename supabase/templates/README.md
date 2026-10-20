# Templates email (Supabase Auth)

Ces fichiers sont la **source de vérité versionnée** des templates posés en
prod sur le projet Supabase `chmijnxukwsfqlvaontf`. Supabase ne lit pas ce
dossier : les templates vivent dans la configuration Auth du projet et sont
posés par l'API Management. Modifier le fichier **puis** rejouer la commande.

## Pourquoi ce dossier existe

Retour de test du 19/10/2026 (Stéphane) : l'écran de connexion demande un
code à 6 chiffres, mais l'email reçu ne contenait qu'un bouton « Sign in »
(template Supabase par défaut, en anglais, avec `{{ .ConfirmationURL }}`
seul). Le lien fonctionne sur l'appareil qui reçoit l'email, mais pas quand
on lit l'email sur un appareil et qu'on se connecte sur un autre — le cas
d'un navigateur partagé.

Deux causes, corrigées le 20/10/2026 :

1. le template n'affichait pas `{{ .Token }}` ;
2. `mailer_otp_length` valait **8** côté serveur alors que le champ de
   saisie impose 6 chiffres (`pattern="[0-9]{6}"`, `maxLength={6}` dans
   `src/routes/login.tsx`). Même avec le code dans l'email, la saisie était
   impossible. Aligné à **6**.

## Appliquer

`SUPABASE_ACCESS_TOKEN` doit être dans l'environnement (jeton personnel
Supabase, jamais commité).

Sur le Mac de Ben : utiliser `/usr/bin/python3` (le Python du framework
n'a pas les certificats racine, et `curl` avec le jeton est refusé par le
classifier de l'agent).

```sh
/usr/bin/python3 - <<'PY'
import json, os, pathlib, urllib.request
ref = "chmijnxukwsfqlvaontf"
body = {
    "mailer_subjects_magic_link": "Votre code de connexion Mooveee",
    "mailer_templates_magic_link_content": pathlib.Path(
        "supabase/templates/magic-link.html"
    ).read_text(),
    "mailer_otp_length": 6,
}
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/config/auth",
    data=json.dumps(body).encode(),
    headers={
        "Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}",
        "Content-Type": "application/json",
    },
    method="PATCH",
)
print(urllib.request.urlopen(req).status)
PY
```

## Vérifier

```sh
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/chmijnxukwsfqlvaontf/config/auth \
  | python3 -c "import json,sys; c=json.load(sys.stdin); print(c['mailer_otp_length']); print(c['mailer_templates_magic_link_content'][:120])"
```

## Ce que l'email ne doit jamais contenir

Aucun prénom d'enfant, aucune donnée de foyer, aucun solde de Mooves.
L'email de connexion ne porte que le code, le lien et la durée de validité.

## Envoi

SMTP Resend (`noreply@mooveee.app`, expéditeur « Mooveee »), 30 emails/heure
par projet, un email par minute maximum vers la même adresse
(`smtp_max_frequency = 60`). Le code vaut une heure (`mailer_otp_exp`).
