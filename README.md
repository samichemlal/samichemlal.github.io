# Site perso: samichemlal.github.io

Site statique (HTML/CSS/JS, sans build). Tout le contenu est dans `index.html`.

## Ajouter un cours

1. Mettre le PDF dans `assets/docs/courses/`, avec un nom sans espace (ex. `neural-networks.pdf`).
2. Dans `index.html`, chercher `NEW COURSE`, copier le bloc `<article …> … </article>` qui suit, le coller juste au-dessus du commentaire (sans les `<!--` / `-->`), puis changer le numéro, le titre, les lignes et le nom du fichier.
3. Envoyer sur GitHub le PDF et le nouveau `index.html`.

## Liens à compléter

Dans `index.html`, remplacer `href="TODO"` par l'URL arXiv de **MTL-CMO** (onglet *Publications*).

Tant que c'est `TODO`, le bouton s'affiche en pointillés (« coming soon »).

## Voir en local

```bash
cd ~/code/site_web_sami
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Mettre en ligne (GitHub Pages)

1. Sur github.com, créer un repo **public** nommé `samichemlal.github.io` (sans README).
2. Puis :
```bash
cd ~/code/site_web_sami
git init -b main
git add .
git commit -m "Personal website"
git remote add origin https://github.com/samichemlal/samichemlal.github.io.git
git push -u origin main
```
3. Le site est en ligne à https://samichemlal.github.io après 1 à 2 minutes.
   Pour une mise à jour : `git add . && git commit -m "update" && git push`.

## Ajouter une news

Dans `index.html`, section `News`, copier une ligne :
```html
<li><time>Oct 2026</time><span>Texte de la news.</span></li>
```
