# VisuChrop

# Spécification des fichiers d'entrées

## Données 
#### Format : .tsv .csv* .tab*
*à condition que les valeurs soient toujours séparées par des tabulations.*
#### Colonnes : chr    start    end    nom_origine1 nom_origine2    …



- **chr :** “chrx” où x est un nombre entre 01 et 99 (le zéro est nécessaire).

- **start :** position de début de la fenêtre.

- **end :** position de fin de la fenêtre.

- **origine1 :** valeur entre 0 et 1.

Ce fichier est normalement généré par le script python prétraitement.py,
il n'est pas implémenté dans le site il est nécessaire de le l'utiliser en amont.

## Couleurs
#### Format : .tsv .csv* .tab* .conf*
*à condition que les valeurs soient toujours séparées par des tabulations.*
#### Colonnes : group    name    hex

- **group :** Doit être égal à une origine du fichier “données”.

- **name :** Nom affiché dans la légende du graphique.

- **hex :** Une couleurs en hexadécimal précédé d’un “#” .

## Chromosomes
#### Format : .tsv .csv* .tab*
*à condition que les valeurs soient toujours séparées par des tabulations.*
#### Colonnes : chr    len    centromereInf    centromereSup


Il est nécessaire d’avoir une numérotation des chromosomes de 01 à 99 **et** continue **dans ce fichier uniquement**, même si les données ne sont que
sur certains chromosomes. Voire le fichier d'exemple [less_origin](https://github.com/pierrick-perelle/VisuChrop/exemple_input_file/less_origin.com/).

- **chr :** “chrx” où x est un nombre entre 01 et 99 (le zéro est nécessaire).

- **len :** la longueur du chromosome.

- **centromereInf :** Borne inférieure de la possible localisation du centromère (en nucléotide).

- **centromereSup :** Borne supérieure de la possible localisation du centromère (en nucléotide).

Les champs centromereInf et centromereSup sont optionnels, en leurs absences le centromère sera placé au millieux du chromosome (len/2).
S'ils sont tous les deux spécifié le centromère sera placé au milieu des deux ((Inf+Sup)/2).
Si un seul est donné (peu importe lequelle) le centromère sera placé à cette position.
