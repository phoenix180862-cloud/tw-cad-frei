// TW-CAD – Material-Datenbank Fassade, Fenster, Haustüren, Dach (Stand 25.10.2026, recherchiert)
// Farbwerte sind Annäherungen an die Herstellerfarben – verbindlich ist immer das Original-Muster.
export const MATERIALIEN = [
{
"id": "prefa-fx12",
"gruppe": "Metall",
"hersteller": "PREFA",
"produkt": "Fassadenpaneel FX.12",
"art": "Paneele horizontal, Alu 0,7 mm",
"muster": "paneel",
"rasterMm": [
1400,
420
],
"fugeMm": 8,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Schwarz",
"hex": "#1E1F21"
},
{
"name": "P.10 Hellgrau",
"hex": "#B9BDBB"
},
{
"name": "P.10 Prefaweiß",
"hex": "#E9E8E0"
},
{
"name": "P.10 Braun",
"hex": "#45372F"
},
{
"name": "P.10 Steingrau",
"hex": "#8A8A82"
}
],
"hinweis": "Langpaneel 1400x420, Kurzpaneel 700x420; diagonale Facette (12°) - Lichtspiel"
},
{
"id": "prefa-siding",
"gruppe": "Metall",
"hersteller": "PREFA",
"produkt": "Siding",
"art": "Paneele horizontal/vertikal",
"muster": "schalung_h",
"rasterMm": [
4000,
138
],
"fugeMm": 10,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Dunkelgrau",
"hex": "#50565A"
},
{
"name": "P.10 Hellgrau",
"hex": "#B9BDBB"
},
{
"name": "P.10 Reinweiß (RAL 9010)",
"hex": "#F1EDE1"
},
{
"name": "P.10 Nussbraun",
"hex": "#5A3E2B"
},
{
"name": "P.10 Moosgrün",
"hex": "#2F4538"
}
],
"hinweis": "Baubreiten 138/200/300/400 mm (Höhe im Raster wählbar); Schattenfuge"
},
{
"id": "prefa-siding-x",
"gruppe": "Metall",
"hersteller": "PREFA",
"produkt": "Siding.X",
"art": "Paneele horizontal, facettiert",
"muster": "schalung_h",
"rasterMm": [
2500,
200
],
"fugeMm": 10,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Schwarz",
"hex": "#1E1F21"
},
{
"name": "P.10 Steingrau",
"hex": "#8A8A82"
},
{
"name": "P.10 Sandbraun",
"hex": "#8C7259"
},
{
"name": "P.10 Rostbraun",
"hex": "#6E3B2A"
},
{
"name": "Patina grau",
"hex": "#6F7672"
}
],
"hinweis": "Baubreiten 200/300/400 mm, Länge 500-6200 mm, Material 1,0 mm"
},
{
"id": "prefa-wandraute-29",
"gruppe": "Metall",
"hersteller": "PREFA",
"produkt": "Wandraute 29x29",
"art": "Rautendeckung",
"muster": "raute",
"rasterMm": [
290,
290
],
"fugeMm": 3,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Hellgrau",
"hex": "#B9BDBB"
},
{
"name": "P.10 Dunkelgrau",
"hex": "#50565A"
},
{
"name": "P.10 Ziegelrot",
"hex": "#8E3B2B"
},
{
"name": "P.10 Oxydrot",
"hex": "#642A25"
}
],
"hinweis": "Raute auf Spitze; auch als 44x44 (440 mm) lieferbar"
},
{
"id": "prefa-wandraute-44",
"gruppe": "Metall",
"hersteller": "PREFA",
"produkt": "Wandraute 44x44",
"art": "Rautendeckung groß",
"muster": "raute",
"rasterMm": [
440,
440
],
"fugeMm": 3,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Schwarz",
"hex": "#1E1F21"
},
{
"name": "P.10 Steingrau",
"hex": "#8A8A82"
},
{
"name": "P.10 Braun",
"hex": "#45372F"
}
],
"hinweis": "Großraute, ruhigeres Bild"
},
{
"id": "prefa-wandschindel",
"gruppe": "Metall",
"hersteller": "PREFA",
"produkt": "Wandschindel",
"art": "Schindeldeckung 1/3-Versatz",
"muster": "schindel",
"rasterMm": [
420,
240
],
"fugeMm": 2,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Hellgrau",
"hex": "#B9BDBB"
},
{
"name": "P.10 Braun",
"hex": "#45372F"
},
{
"name": "P.10 Prefaweiß",
"hex": "#E9E8E0"
}
],
"hinweis": "10 Stk/m²; XL-Variante 840x240; Oberfläche stucco oder glatt"
},
{
"id": "prefa-prefalz-fassade",
"gruppe": "Metall",
"hersteller": "PREFA",
"produkt": "Prefalz",
"art": "Stehfalz vertikal",
"muster": "stehfalz",
"rasterMm": [
580,
25
],
"fugeMm": 0,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Schwarz",
"hex": "#1E1F21"
},
{
"name": "P.10 Hellgrau",
"hex": "#B9BDBB"
},
{
"name": "Silbermetallic",
"hex": "#A5A9AB"
},
{
"name": "Bronze",
"hex": "#6B5A45"
},
{
"name": "P.10 Moosgrün",
"hex": "#2F4538"
}
],
"hinweis": "Achsmaß ca. 430/580 mm (Bandbreite 500/650), Falzhöhe ca. 25 mm"
},
{
"id": "prefa-zackenprofil",
"gruppe": "Metall",
"hersteller": "PREFA",
"produkt": "Zackenprofil",
"art": "Profilpaneel vertikal",
"muster": "trapez",
"rasterMm": [
200,
30
],
"fugeMm": 0,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Dunkelgrau",
"hex": "#50565A"
},
{
"name": "Silbermetallic",
"hex": "#A5A9AB"
}
],
"hinweis": "Sägezahnprofil; Achsmaß ca. 200 mm (bitte am Datenblatt prüfen)"
},
{
"id": "rheinzink-stehfalz",
"gruppe": "Metall",
"hersteller": "RHEINZINK",
"produkt": "Doppelstehfalz Fassade",
"art": "Stehfalz vertikal, Titanzink",
"muster": "stehfalz",
"rasterMm": [
430,
25
],
"fugeMm": 0,
"farben": [
{
"name": "prePATINA blaugrau",
"hex": "#8A9196"
},
{
"name": "prePATINA schiefergrau",
"hex": "#5E6366"
},
{
"name": "prePATINA graphitgrau",
"hex": "#45494C"
},
{
"name": "CLASSIC walzblank",
"hex": "#B8BDC0"
}
],
"hinweis": "Achsmaß je nach Bandbreite (500/600 mm -> ca. 430/530)"
},
{
"id": "rheinzink-winkelstehfalz",
"gruppe": "Metall",
"hersteller": "RHEINZINK",
"produkt": "Winkelstehfalz",
"art": "Winkelfalz vertikal",
"muster": "stehfalz",
"rasterMm": [
530,
20
],
"fugeMm": 0,
"farben": [
{
"name": "prePATINA blaugrau",
"hex": "#8A9196"
},
{
"name": "prePATINA schiefergrau",
"hex": "#5E6366"
},
{
"name": "artCOLOR Anthrazit",
"hex": "#3A3D3F"
}
],
"hinweis": "flacher, angelegter Falz"
},
{
"id": "corten-paneel",
"gruppe": "Metall",
"hersteller": "herstellerneutral",
"produkt": "Cortenstahl-Platten",
"art": "Großformatplatte/Paneel",
"muster": "platte",
"rasterMm": [
3000,
1000
],
"fugeMm": 10,
"farben": [
{
"name": "Corten frisch",
"hex": "#8D5A3B"
},
{
"name": "Corten patiniert",
"hex": "#6B3E26"
},
{
"name": "Corten dunkel",
"hex": "#4E2E1E"
}
],
"hinweis": "wetterfester Baustahl; Patina mit Rostablauf beachten"
},
{
"id": "kalzip-65-400",
"gruppe": "Metall",
"hersteller": "Kalzip",
"produkt": "Kalzip 65/400",
"art": "Aluminium-Stehfalz",
"muster": "stehfalz",
"rasterMm": [
400,
65
],
"fugeMm": 0,
"farben": [
{
"name": "Alu natur stucco",
"hex": "#C8CBCC"
},
{
"name": "RAL 9006 Weißaluminium",
"hex": "#A5A8A6"
},
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
}
],
"hinweis": "Achsmaß 400 mm, Falzhöhe 65 mm"
},
{
"id": "trapez-35-207",
"gruppe": "Metall",
"hersteller": "herstellerneutral",
"produkt": "Trapezprofil 35/207",
"art": "Trapezblech vertikal",
"muster": "trapez",
"rasterMm": [
207,
35
],
"fugeMm": 0,
"farben": [
{
"name": "RAL 9006 Weißaluminium",
"hex": "#A5A8A6"
},
{
"name": "RAL 9002 Grauweiß",
"hex": "#E7EBDA"
},
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "RAL 8012 Rotbraun",
"hex": "#59191F"
}
],
"hinweis": "Rippenabstand 207 mm; Hallen/Nebengebäude"
},
{
"id": "well-76-18",
"gruppe": "Metall",
"hersteller": "herstellerneutral",
"produkt": "Wellprofil 76/18",
"art": "Wellblech",
"muster": "welle",
"rasterMm": [
76,
18
],
"fugeMm": 0,
"farben": [
{
"name": "Alu natur",
"hex": "#C3C6C8"
},
{
"name": "verzinkt",
"hex": "#A9AEB1"
},
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
}
],
"hinweis": "Wellenabstand 76 mm"
},
{
"id": "equitone-tectiva",
"gruppe": "Faserzement",
"hersteller": "Equitone",
"produkt": "[tectiva]",
"art": "Großformatplatte, durchgefärbt, geschliffen",
"muster": "platte",
"rasterMm": [
1220,
3050
],
"fugeMm": 8,
"farben": [
{
"name": "TE00",
"hex": "#D6D4CE"
},
{
"name": "TE10",
"hex": "#B9B8B2"
},
{
"name": "TE20",
"hex": "#8F908C"
},
{
"name": "TE85",
"hex": "#4A4B4B"
},
{
"name": "TE90",
"hex": "#2E2F30"
}
],
"hinweis": "8 mm; 1220x2500/3050; feine Schleiflinien; Hex Annäherung"
},
{
"id": "equitone-natura",
"gruppe": "Faserzement",
"hersteller": "Equitone",
"produkt": "[natura]",
"art": "Großformatplatte, durchgefärbt, lasiert",
"muster": "platte",
"rasterMm": [
1250,
3100
],
"fugeMm": 8,
"farben": [
{
"name": "N073",
"hex": "#DCDCD6"
},
{
"name": "N250",
"hex": "#8C8D8A"
},
{
"name": "N251",
"hex": "#6B6D6C"
},
{
"name": "N252",
"hex": "#4D4F50"
},
{
"name": "N661",
"hex": "#8C4A3A"
}
],
"hinweis": "8/12 mm; 1250x2500/3100; seidenmatt; Hex Annäherung"
},
{
"id": "equitone-pictura",
"gruppe": "Faserzement",
"hersteller": "Equitone",
"produkt": "[pictura]",
"art": "Großformatplatte, deckend beschichtet",
"muster": "platte",
"rasterMm": [
1250,
3100
],
"fugeMm": 8,
"farben": [
{
"name": "PW 141",
"hex": "#EFEEE9"
},
{
"name": "PW 841",
"hex": "#E6E1D5"
},
{
"name": "PG 542",
"hex": "#9A9B98"
},
{
"name": "PA 944",
"hex": "#3A3B3C"
},
{
"name": "PA 041",
"hex": "#232425"
}
],
"hinweis": "glatt matt; PW=weiße, PG=graue, PA=anthrazit Basis"
},
{
"id": "equitone-lunara",
"gruppe": "Faserzement",
"hersteller": "Equitone",
"produkt": "[lunara]",
"art": "Großformatplatte, rau",
"muster": "platte",
"rasterMm": [
1220,
3050
],
"fugeMm": 8,
"farben": [
{
"name": "LA20",
"hex": "#8A8A86"
},
{
"name": "LA60",
"hex": "#4C4C4A"
}
],
"hinweis": "mondartige, unpolierte Oberfläche; 8/10 mm"
},
{
"id": "equitone-linea",
"gruppe": "Faserzement",
"hersteller": "Equitone",
"produkt": "[linea]",
"art": "Großformatplatte, profiliert",
"muster": "schalung_v",
"rasterMm": [
1220,
3050
],
"fugeMm": 8,
"farben": [
{
"name": "LT20",
"hex": "#8F908C"
},
{
"name": "LT60",
"hex": "#5E5F5E"
},
{
"name": "LT90",
"hex": "#2F3031"
}
],
"hinweis": "Rillenprofil längs, 10 mm; als feine Vertikalstruktur darstellen"
},
{
"id": "eternit-natura-klein",
"gruppe": "Faserzement",
"hersteller": "Eternit",
"produkt": "Natura Kleinformat 60/32",
"art": "Kleinformat, Doppeldeckung/Linum",
"muster": "schindel",
"rasterMm": [
600,
320
],
"fugeMm": 4,
"farben": [
{
"name": "anthrazit",
"hex": "#45484A"
},
{
"name": "naturgrau",
"hex": "#8F918E"
},
{
"name": "beige",
"hex": "#B8AD98"
}
],
"hinweis": "auch 40/20; 7 Deckungsbilder (Linum, Plenum, Novum, Mosaik)"
},
{
"id": "eternit-fassadenschiefer-rechteck",
"gruppe": "Faserzement",
"hersteller": "Eternit/Swisspearl",
"produkt": "Fassadenschiefer Rechteck-Doppeldeckung",
"art": "Kleinformat-Schindel",
"muster": "schindel",
"rasterMm": [
300,
135
],
"fugeMm": 2,
"farben": [
{
"name": "Blauschwarz",
"hex": "#2E3034"
},
{
"name": "Anthrazit",
"hex": "#3F4245"
},
{
"name": "Grau",
"hex": "#75787A"
},
{
"name": "Rotbraun",
"hex": "#6E3D30"
}
],
"hinweis": "Streifen 3x300x300, sichtbare Höhe 135 mm; Farbnamen generisch"
},
{
"id": "eternit-fassadenschiefer-rhombus",
"gruppe": "Faserzement",
"hersteller": "Eternit/Swisspearl",
"produkt": "Fassadenschiefer Rhombus/Spitzwinkel",
"art": "Rautendeckung",
"muster": "raute",
"rasterMm": [
400,
400
],
"fugeMm": 2,
"farben": [
{
"name": "Blauschwarz",
"hex": "#2E3034"
},
{
"name": "Anthrazit",
"hex": "#3F4245"
},
{
"name": "Grau",
"hex": "#75787A"
}
],
"hinweis": "klassische Giebel-/Wetterseitenbekleidung"
},
{
"id": "cedral-lap",
"gruppe": "Faserzement",
"hersteller": "Cedral (Eternit)",
"produkt": "Cedral Lap",
"art": "Stülpschalung horizontal",
"muster": "schalung_h",
"rasterMm": [
3600,
160
],
"fugeMm": 0,
"farben": [
{
"name": "C01 Reinweiß (≈RAL 9010)",
"hex": "#F1EDE1"
},
{
"name": "C18 Hellgrau (≈RAL 7035)",
"hex": "#CBD0CC"
},
{
"name": "C50 Anthrazit (≈RAL 7016)",
"hex": "#383E42"
},
{
"name": "C15 Tiefschwarz (≈RAL 9005)",
"hex": "#0E0E10"
},
{
"name": "C74 Basaltgrau (≈RAL 7012)",
"hex": "#4E5754"
},
{
"name": "C61 Wood-Look Eiche",
"hex": "#8A6A4A"
}
],
"hinweis": "Paneel 3600x190x10, sichtbar ca. 160 mm (Überlappung 30)"
},
{
"id": "cedral-click",
"gruppe": "Faserzement",
"hersteller": "Cedral (Eternit)",
"produkt": "Cedral Click",
"art": "Nut-Feder flächenbündig, horiz./vert.",
"muster": "schalung_h",
"rasterMm": [
3600,
174
],
"fugeMm": 6,
"farben": [
{
"name": "C01 Reinweiß",
"hex": "#F1EDE1"
},
{
"name": "C04 Sandbeige (≈RAL 1019)",
"hex": "#A48F7A"
},
{
"name": "C52 Hellgrau warm (≈RAL 7038)",
"hex": "#B5B8B1"
},
{
"name": "C50 Anthrazit",
"hex": "#383E42"
},
{
"name": "C58 Wood-Look Walnuss",
"hex": "#5A3F2C"
}
],
"hinweis": "3600x186x12, Deckbreite ca. 174 mm, Schattenfuge"
},
{
"id": "trespa-meteon-uni",
"gruppe": "HPL",
"hersteller": "Trespa",
"produkt": "Meteon Uni Colours",
"art": "HPL-Kompaktplatte",
"muster": "platte",
"rasterMm": [
1530,
3050
],
"fugeMm": 8,
"farben": [
{
"name": "A05.0.0 Pure White",
"hex": "#F3F3EF"
},
{
"name": "A21.1.0 Winter Grey",
"hex": "#C9CBCB"
},
{
"name": "A21.5.1 Mid Grey",
"hex": "#7F8384"
},
{
"name": "A25.8.1 Anthracite Grey",
"hex": "#3A3D40"
},
{
"name": "A90.0.0 Black",
"hex": "#1C1C1D"
},
{
"name": "A10.3.4 Terra Cotta",
"hex": "#A9573C"
}
],
"hinweis": "Formate 2550x1860, 3050x1530, 3650x1860, 4270x2130; 6-13 mm"
},
{
"id": "trespa-meteon-wood",
"gruppe": "HPL",
"hersteller": "Trespa",
"produkt": "Meteon Wood Decors",
"art": "HPL-Kompaktplatte Holzdekor",
"muster": "schalung_h",
"rasterMm": [
3650,
186
],
"fugeMm": 8,
"farben": [
{
"name": "NW02 Elegant Oak",
"hex": "#A47A52"
},
{
"name": "NW24 Greyed Cedar",
"hex": "#8B8378"
},
{
"name": "NW08 Italian Walnut",
"hex": "#5E4130"
},
{
"name": "NW23 Nordic Black",
"hex": "#2A2725"
}
],
"hinweis": "oft als Paneelstreifen (Lamellen) zugeschnitten"
},
{
"id": "fundermax-uni",
"gruppe": "HPL",
"hersteller": "Fundermax",
"produkt": "Max Exterior Unicolors",
"art": "HPL-Kompaktplatte NT",
"muster": "platte",
"rasterMm": [
1300,
2800
],
"fugeMm": 8,
"farben": [
{
"name": "0085 Weiss",
"hex": "#F2F2EE"
},
{
"name": "0074 Pastellgrau",
"hex": "#C6C8C6"
},
{
"name": "0075 Dunkelgrau",
"hex": "#5B5F61"
},
{
"name": "0077 Graphitgrau",
"hex": "#3C4043"
},
{
"name": "0080 Schwarz",
"hex": "#1C1C1C"
},
{
"name": "0661 Terrakotta",
"hex": "#A9573E"
}
],
"hinweis": "Formate 2800x1300, 4100x1300, 3670x1630, 2800/4100x1854"
},
{
"id": "fundermax-holz",
"gruppe": "HPL",
"hersteller": "Fundermax",
"produkt": "Max Exterior Nature",
"art": "HPL-Kompaktplatte Holzdekor",
"muster": "schalung_h",
"rasterMm": [
4100,
200
],
"fugeMm": 8,
"farben": [
{
"name": "0927 Creek Lärche",
"hex": "#B08A62"
},
{
"name": "0125 Eiche Natur",
"hex": "#B58B5E"
},
{
"name": "0907 Flagship Eiche Graphit",
"hex": "#4D4A47"
},
{
"name": "0908 Flagship Eiche Grau",
"hex": "#8A857D"
}
],
"hinweis": "als Paneelstreifen geschnitten"
},
{
"id": "rockpanel-colours",
"gruppe": "HPL",
"hersteller": "Rockpanel",
"produkt": "Rockpanel Colours",
"art": "Steinwollplatte beschichtet",
"muster": "platte",
"rasterMm": [
1200,
3050
],
"fugeMm": 8,
"farben": [
{
"name": "RAL 9010 Reinweiß",
"hex": "#F1EDE1"
},
{
"name": "RAL 7035 Lichtgrau",
"hex": "#CBD0CC"
},
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "RAL 9005 Tiefschwarz",
"hex": "#0E0E10"
}
],
"hinweis": "3050x1200x8 mm; RAL/NCS frei wählbar"
},
{
"id": "rockpanel-woods",
"gruppe": "HPL",
"hersteller": "Rockpanel",
"produkt": "Rockpanel Woods",
"art": "Steinwollpaneel Holzoptik",
"muster": "schalung_h",
"rasterMm": [
3050,
200
],
"fugeMm": 8,
"farben": [
{
"name": "Rhinestone Oak",
"hex": "#9A8C7C"
},
{
"name": "Caramel Oak",
"hex": "#A3754C"
},
{
"name": "Black Oak",
"hex": "#2E2A27"
},
{
"name": "Teak",
"hex": "#8A5F3C"
}
],
"hinweis": "Streifen in mehreren Breiten"
},
{
"id": "holz-laerche-bodendeckel",
"gruppe": "Holz",
"hersteller": "herstellerneutral",
"produkt": "Lärche Boden-Deckel-Schalung",
"art": "vertikal, sägerau/gehobelt",
"muster": "boden_deckel",
"rasterMm": [
200,
70
],
"fugeMm": 0,
"farben": [
{
"name": "Lärche natur",
"hex": "#C8955E"
},
{
"name": "Lärche vergraut",
"hex": "#8E8C86"
},
{
"name": "Lärche silbergrau vorvergraut",
"hex": "#A7A49D"
}
],
"hinweis": "Bodenbrett ca. 140-200, Deckleiste ca. 70 mm"
},
{
"id": "holz-laerche-rhombus",
"gruppe": "Holz",
"hersteller": "herstellerneutral",
"produkt": "Lärche Rhombusleisten 68x27",
"art": "Rhombusschalung horizontal, offen",
"muster": "rhombus",
"rasterMm": [
3000,
68
],
"fugeMm": 8,
"farben": [
{
"name": "Lärche natur",
"hex": "#C8955E"
},
{
"name": "Lärche vergraut",
"hex": "#8E8C86"
},
{
"name": "Lärche geölt",
"hex": "#B07A45"
}
],
"hinweis": "Leiste 68 mm, offene Fuge 8-10 mm, Fuge dunkel (Fassadenbahn schwarz)"
},
{
"id": "holz-douglasie-rhombus",
"gruppe": "Holz",
"hersteller": "herstellerneutral",
"produkt": "Douglasie Rhombusleisten",
"art": "Rhombusschalung horizontal",
"muster": "rhombus",
"rasterMm": [
3000,
68
],
"fugeMm": 8,
"farben": [
{
"name": "Douglasie natur",
"hex": "#C27E52"
},
{
"name": "Douglasie vergraut",
"hex": "#8A857C"
}
],
"hinweis": "rötlicher Ton, vergraut silbrig"
},
{
"id": "holz-fichte-stuelp",
"gruppe": "Holz",
"hersteller": "herstellerneutral",
"produkt": "Fichte Stülpschalung gestrichen",
"art": "Stülpschalung horizontal",
"muster": "schalung_h",
"rasterMm": [
4000,
120
],
"fugeMm": 0,
"farben": [
{
"name": "Schwedenrot",
"hex": "#8B2F22"
},
{
"name": "RAL 9010 Weiß",
"hex": "#F1EDE1"
},
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "RAL 7030 Steingrau",
"hex": "#939388"
},
{
"name": "Taubenblau",
"hex": "#6E8091"
}
],
"hinweis": "Brett 146, Deckbreite ca. 120 mm, Schattenkante unten"
},
{
"id": "holz-fichte-nf-vertikal",
"gruppe": "Holz",
"hersteller": "herstellerneutral",
"produkt": "Fichte Nut-Feder vertikal gestrichen",
"art": "Profilholz vertikal",
"muster": "schalung_v",
"rasterMm": [
146,
3000
],
"fugeMm": 3,
"farben": [
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "RAL 9005 Tiefschwarz",
"hex": "#0E0E10"
},
{
"name": "RAL 7035 Lichtgrau",
"hex": "#CBD0CC"
}
],
"hinweis": "Deckbreite ca. 121-146 mm, V-Fuge"
},
{
"id": "holz-thermo-nf-horizontal",
"gruppe": "Holz",
"hersteller": "herstellerneutral",
"produkt": "Thermoholz (Kiefer/Esche) Nut-Feder horizontal",
"art": "Profilholz horizontal",
"muster": "schalung_h",
"rasterMm": [
3000,
120
],
"fugeMm": 5,
"farben": [
{
"name": "Thermo-Kiefer",
"hex": "#7A5638"
},
{
"name": "Thermo-Esche",
"hex": "#6B4A33"
},
{
"name": "Thermoholz vergraut",
"hex": "#8C8780"
}
],
"hinweis": "dunkelbraun, vergraut ohne Pflege silbergrau"
},
{
"id": "holz-weisstanne-rhombus",
"gruppe": "Holz",
"hersteller": "herstellerneutral",
"produkt": "Weißtanne Rhombus/Glattkant",
"art": "vertikal oder horizontal",
"muster": "rhombus",
"rasterMm": [
3000,
68
],
"fugeMm": 8,
"farben": [
{
"name": "Weißtanne natur",
"hex": "#D9C5A3"
},
{
"name": "Weißtanne vorvergraut",
"hex": "#A9A59C"
}
],
"hinweis": "harzfrei, sehr hell, vergraut gleichmäßig"
},
{
"id": "holz-laerche-nf-vertikal",
"gruppe": "Holz",
"hersteller": "herstellerneutral",
"produkt": "Lärche Nut-Feder vertikal",
"art": "Profilholz vertikal",
"muster": "schalung_v",
"rasterMm": [
121,
3000
],
"fugeMm": 3,
"farben": [
{
"name": "Lärche natur",
"hex": "#C8955E"
},
{
"name": "Lärche vergraut",
"hex": "#8E8C86"
}
],
"hinweis": "Deckbreite ca. 121 mm"
},
{
"id": "putz-scheibenputz",
"gruppe": "Putz",
"hersteller": "herstellerneutral",
"produkt": "Scheibenputz K2/K3",
"art": "Oberputz, Vollkorn",
"muster": "putz",
"rasterMm": [
3,
3
],
"fugeMm": 0,
"farben": [
{
"name": "Weiß",
"hex": "#F2F1EC"
},
{
"name": "Hellgrau",
"hex": "#C9C9C4"
},
{
"name": "Sand",
"hex": "#D9C9A6"
},
{
"name": "Anthrazit",
"hex": "#4A4D4F"
},
{
"name": "Terrakotta",
"hex": "#B5643F"
}
],
"hinweis": "rasterMm = Körnung 2/3 mm; gleichmäßig körnige Textur"
},
{
"id": "putz-rauputz",
"gruppe": "Putz",
"hersteller": "herstellerneutral",
"produkt": "Rauputz/Reibeputz R3",
"art": "Oberputz, Rillenkorn",
"muster": "putz",
"rasterMm": [
3,
3
],
"fugeMm": 0,
"farben": [
{
"name": "Weiß",
"hex": "#F2F1EC"
},
{
"name": "Altweiß",
"hex": "#ECE6D8"
},
{
"name": "Hellgrau",
"hex": "#C9C9C4"
},
{
"name": "Sand",
"hex": "#D9C9A6"
},
{
"name": "Terrakotta",
"hex": "#B5643F"
}
],
"hinweis": "Rillen-/Wurmstruktur"
},
{
"id": "putz-kratzputz",
"gruppe": "Putz",
"hersteller": "herstellerneutral",
"produkt": "Edelkratzputz",
"art": "mineralischer Kratzputz",
"muster": "putz",
"rasterMm": [
4,
4
],
"fugeMm": 0,
"farben": [
{
"name": "Naturweiß",
"hex": "#EEEBE3"
},
{
"name": "Hellgrau",
"hex": "#C9C9C4"
},
{
"name": "Sand",
"hex": "#D9C9A6"
},
{
"name": "Ocker",
"hex": "#CFAE76"
}
],
"hinweis": "lebhafte, offene Struktur"
},
{
"id": "putz-glattputz",
"gruppe": "Putz",
"hersteller": "herstellerneutral",
"produkt": "Glattputz/Filzputz",
"art": "feiner Oberputz",
"muster": "putz",
"rasterMm": [
1,
1
],
"fugeMm": 0,
"farben": [
{
"name": "Weiß",
"hex": "#F2F1EC"
},
{
"name": "Hellgrau",
"hex": "#C9C9C4"
},
{
"name": "Anthrazit",
"hex": "#4A4D4F"
},
{
"name": "Terrakotta",
"hex": "#B5643F"
}
],
"hinweis": "Körnung ≤1 mm, fast glatt"
},
{
"id": "terca-rotbunt-nf",
"gruppe": "Klinker",
"hersteller": "Wienerberger (Terca)",
"produkt": "Klinker KMz rotbunt glatt NF",
"art": "Vormauerklinker Läuferverband",
"muster": "klinker",
"rasterMm": [
240,
71
],
"fugeMm": 10,
"farben": [
{
"name": "rotbunt",
"hex": "#8B4434"
},
{
"name": "rotbunt hell",
"hex": "#A15A43"
},
{
"name": "rotbunt dunkel",
"hex": "#6E3326"
}
],
"hinweis": "NF 240x115x71; Fuge mittelgrau; mehrere Töne zufällig mischen",
"fugenFarbe": "#8E8C87"
},
{
"id": "terca-rot-df",
"gruppe": "Klinker",
"hersteller": "Wienerberger (Terca)",
"produkt": "Klinker KMz rot nuanciert DF",
"art": "Vormauerklinker",
"muster": "klinker",
"rasterMm": [
240,
52
],
"fugeMm": 10,
"farben": [
{
"name": "rot nuanciert",
"hex": "#9A3F2E"
},
{
"name": "rot hell",
"hex": "#AC4E3A"
}
],
"hinweis": "DF 240x115x52",
"fugenFarbe": "#A6A39C"
},
{
"id": "terca-dresden-rf",
"gruppe": "Klinker",
"hersteller": "Wienerberger (Terca)",
"produkt": "Klinker Dresden anthrazitbraun RF",
"art": "Vormauerklinker",
"muster": "klinker",
"rasterMm": [
240,
65
],
"fugeMm": 10,
"farben": [
{
"name": "anthrazitbraun nuanciert",
"hex": "#3E342F"
},
{
"name": "braun",
"hex": "#57463B"
}
],
"hinweis": "RF 240x115x65; dunkle Fuge",
"fugenFarbe": "#5A5754"
},
{
"id": "roeben-faro-grau",
"gruppe": "Klinker",
"hersteller": "Röben",
"produkt": "FARO grau-nuanciert glatt",
"art": "Verblender",
"muster": "klinker",
"rasterMm": [
240,
52
],
"fugeMm": 10,
"farben": [
{
"name": "grau-nuanciert",
"hex": "#8A8784"
},
{
"name": "grau hell",
"hex": "#A19E9A"
},
{
"name": "grau dunkel",
"hex": "#6B6866"
}
],
"hinweis": "DF/NF/Lang-DF (290x52) lieferbar",
"fugenFarbe": "#6E6C69"
},
{
"id": "roeben-faro-schwarz",
"gruppe": "Klinker",
"hersteller": "Röben",
"produkt": "FARO schwarz-nuanciert glatt",
"art": "Verblender",
"muster": "klinker",
"rasterMm": [
240,
71
],
"fugeMm": 10,
"farben": [
{
"name": "schwarz-nuanciert",
"hex": "#2F2E2E"
},
{
"name": "anthrazit",
"hex": "#3B3A3A"
}
],
"hinweis": "NF 240x115x71; auch DF",
"fugenFarbe": "#3C3B3A"
},
{
"id": "klinker-gelb-wdf",
"gruppe": "Klinker",
"hersteller": "herstellerneutral (z. B. Hagemeister)",
"produkt": "Wasserstrichklinker gelb-bunt WDF",
"art": "Verblender",
"muster": "klinker",
"rasterMm": [
210,
65
],
"fugeMm": 12,
"farben": [
{
"name": "gelb",
"hex": "#D6B572"
},
{
"name": "gelb-bunt",
"hex": "#C9A262"
},
{
"name": "sandgelb",
"hex": "#DCC596"
}
],
"hinweis": "WDF 210x100x65; helle Fuge; Sortierung beim Hersteller wählen",
"fugenFarbe": "#C9C4B8"
},
{
"id": "klinker-weiss-wdf",
"gruppe": "Klinker",
"hersteller": "herstellerneutral (z. B. Hagemeister)",
"produkt": "Wasserstrichklinker weiß-nuanciert WDF",
"art": "Verblender",
"muster": "klinker",
"rasterMm": [
210,
65
],
"fugeMm": 12,
"farben": [
{
"name": "weiß",
"hex": "#E4E0D6"
},
{
"name": "weiß-grau",
"hex": "#CFCBC2"
}
],
"hinweis": "WDF 210x100x65",
"fugenFarbe": "#D8D5CE"
},
{
"id": "rathscheck-schiefer-fassade",
"gruppe": "Naturstein",
"hersteller": "Rathscheck",
"produkt": "Moselschiefer Rechteck InterSIN 40x20",
"art": "Rechteck-Doppeldeckung",
"muster": "schindel",
"rasterMm": [
200,
170
],
"fugeMm": 2,
"farben": [
{
"name": "Moselschiefer blauschwarz",
"hex": "#2F3238"
},
{
"name": "Schiefer anthrazit",
"hex": "#3A3D42"
}
],
"hinweis": "Stein 400x200; sichtbare Höhe ca. 170 mm (abh. Überdeckung)"
},
{
"id": "rathscheck-schiefer-altdeutsch",
"gruppe": "Naturstein",
"hersteller": "Rathscheck",
"produkt": "Moselschiefer Schuppen/Altdeutsch",
"art": "Schuppendeckung",
"muster": "schindel",
"rasterMm": [
250,
200
],
"fugeMm": 2,
"farben": [
{
"name": "Moselschiefer blauschwarz",
"hex": "#2F3238"
}
],
"hinweis": "Bogenschnitt; als Schindel mit runder Unterkante"
},
{
"id": "sandstein-platten",
"gruppe": "Naturstein",
"hersteller": "herstellerneutral",
"produkt": "Sandstein-Fassadenplatten",
"art": "Platten vorgehängt",
"muster": "naturstein",
"rasterMm": [
600,
400
],
"fugeMm": 6,
"farben": [
{
"name": "Mainsandstein rot",
"hex": "#A5574A"
},
{
"name": "Sandstein gelb",
"hex": "#CDB98A"
},
{
"name": "Sandstein grau-grün",
"hex": "#9D9C86"
}
],
"hinweis": "Läuferverband, leichte Aderung"
},
{
"id": "granit-platten",
"gruppe": "Naturstein",
"hersteller": "herstellerneutral",
"produkt": "Granit-Fassadenplatten geflammt",
"art": "Platten vorgehängt",
"muster": "naturstein",
"rasterMm": [
900,
600
],
"fugeMm": 8,
"farben": [
{
"name": "Granit hellgrau",
"hex": "#B8B6B1"
},
{
"name": "Granit grau",
"hex": "#8D8C89"
},
{
"name": "Nero Impala",
"hex": "#3A3A3A"
}
],
"hinweis": "feine Sprenkelung"
},
{
"id": "agrob-keratwin-k20",
"gruppe": "Keramik",
"hersteller": "Agrob Buchtal",
"produkt": "KeraTwin K20",
"art": "Keramik-Fassadenplatte hinterlüftet",
"muster": "platte",
"rasterMm": [
1200,
300
],
"fugeMm": 8,
"farben": [
{
"name": "403 rot",
"hex": "#A2453A"
},
{
"name": "410 creme",
"hex": "#E3D8BE"
},
{
"name": "414 hellgrau",
"hex": "#BDBDB8"
},
{
"name": "415 N vulkangrau",
"hex": "#5C5E5E"
},
{
"name": "409 eisengrau",
"hex": "#6E7072"
},
{
"name": "419 schwarz",
"hex": "#222324"
}
],
"hinweis": "20 mm; Höhen 150-600, Längen bis 1800 mm"
},
{
"id": "moeding-longoton",
"gruppe": "Keramik",
"hersteller": "Moeding",
"produkt": "Longoton",
"art": "Ziegel-Fassadenplatte",
"muster": "platte",
"rasterMm": [
1200,
300
],
"fugeMm": 8,
"farben": [
{
"name": "naturrot",
"hex": "#A9573F"
},
{
"name": "hellgrau",
"hex": "#BAB6AF"
},
{
"name": "anthrazit",
"hex": "#45423F"
}
],
"hinweis": "lange Formate (bis ca. 3 m); Farben objektbezogen, hier Beispiele"
},
{
"id": "glas-pfosten-riegel",
"gruppe": "Glas",
"hersteller": "herstellerneutral",
"produkt": "Pfosten-Riegel-Glasfassade",
"art": "Vorhangfassade",
"muster": "glas",
"rasterMm": [
1500,
3000
],
"fugeMm": 50,
"farben": [
{
"name": "Klarglas",
"hex": "#9FB4BE"
},
{
"name": "Sonnenschutz neutral",
"hex": "#7E8F98"
},
{
"name": "Sonnenschutz blau",
"hex": "#5E7A8E"
},
{
"name": "Profil RAL 7016",
"hex": "#383E42"
}
],
"hinweis": "fugeMm = Profilansichtsbreite 50 mm"
},
{
"id": "glas-emailliert",
"gruppe": "Glas",
"hersteller": "herstellerneutral",
"produkt": "Fassadenglas emailliert (ESG)",
"art": "Brüstungs-/Paneelglas",
"muster": "glas",
"rasterMm": [
1250,
2500
],
"fugeMm": 10,
"farben": [
{
"name": "RAL 9010 Reinweiß",
"hex": "#F1EDE1"
},
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "RAL 9005 Tiefschwarz",
"hex": "#0E0E10"
},
{
"name": "RAL 5014 Taubenblau",
"hex": "#606E8C"
}
],
"hinweis": "rückseitig emailliert, glänzend spiegelnd"
},
{
"id": "rieder-concrete-skin",
"gruppe": "Glas",
"hersteller": "Rieder",
"produkt": "concrete skin (Glasfaserbeton)",
"art": "Glasfaserbeton-Platte",
"muster": "platte",
"rasterMm": [
1200,
2500
],
"fugeMm": 8,
"farben": [
{
"name": "ivory",
"hex": "#E4DFD3"
},
{
"name": "silvergrey",
"hex": "#A3A3A0"
},
{
"name": "anthracite",
"hex": "#4A4A49"
},
{
"name": "terracotta",
"hex": "#A7614A"
}
],
"hinweis": "13 mm; Farbnamen/Hex Annäherung"
},
{
"id": "fenster-kst-weiss",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Kunststofffenster weiß",
"art": "PVC",
"muster": "fenster",
"rasterMm": [
115,
82
],
"fugeMm": 0,
"farben": [
{
"name": "Weiß RAL 9016",
"hex": "#F1F0EA"
}
],
"hinweis": "rasterMm = Ansichtsbreite Rahmen+Flügel / Bautiefe"
},
{
"id": "fenster-kst-7016-aussen",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Kunststofffenster Außenfolie Anthrazit",
"art": "PVC, außen foliert, innen weiß",
"muster": "fenster",
"rasterMm": [
115,
82
],
"fugeMm": 0,
"farben": [
{
"name": "Anthrazitgrau RAL 7016 genarbt (7016.05)",
"hex": "#383E42"
},
{
"name": "Anthrazitgrau seidenglatt",
"hex": "#3B4145"
},
{
"name": "innen Weiß RAL 9016",
"hex": "#F1F0EA"
}
],
"hinweis": "häufigste Kombination im Neubau"
},
{
"id": "fenster-kst-golden-oak",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Kunststofffenster Golden Oak",
"art": "PVC foliert",
"muster": "fenster",
"rasterMm": [
115,
82
],
"fugeMm": 0,
"farben": [
{
"name": "Golden Oak (436-2076)",
"hex": "#9A5B2A"
}
],
"hinweis": "Holzmaserung angedeutet"
},
{
"id": "fenster-kst-nussbaum",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Kunststofffenster Nussbaum",
"art": "PVC foliert",
"muster": "fenster",
"rasterMm": [
115,
82
],
"fugeMm": 0,
"farben": [
{
"name": "Nussbaum (436-2075)",
"hex": "#5C3A22"
}
],
"hinweis": "Holzmaserung"
},
{
"id": "fenster-kst-schwarzbraun",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Kunststofffenster Schwarzbraun",
"art": "PVC foliert",
"muster": "fenster",
"rasterMm": [
115,
82
],
"fugeMm": 0,
"farben": [
{
"name": "Schwarzbraun (8518.05)",
"hex": "#3A2C26"
}
],
"hinweis": "Sanierung 70er/80er"
},
{
"id": "fenster-kst-grau",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Kunststofffenster Grautöne glatt",
"art": "PVC foliert",
"muster": "fenster",
"rasterMm": [
115,
82
],
"fugeMm": 0,
"farben": [
{
"name": "Quarzgrau RAL 7039",
"hex": "#6C6960"
},
{
"name": "Basaltgrau RAL 7012",
"hex": "#4E5754"
},
{
"name": "Schiefergrau RAL 7015",
"hex": "#434750"
}
],
"hinweis": "ungenarbte Folien"
},
{
"id": "fenster-holz-eiche",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Holzfenster Eiche",
"art": "Holz IV78",
"muster": "fenster",
"rasterMm": [
120,
78
],
"fugeMm": 0,
"farben": [
{
"name": "Eiche natur geölt",
"hex": "#A9824F"
},
{
"name": "Eiche hell",
"hex": "#C49E6C"
},
{
"name": "Mooreiche",
"hex": "#4A3A2D"
}
],
"hinweis": "IV68/IV78/IV92"
},
{
"id": "fenster-holz-fichte-weiss",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Holzfenster Fichte/Kiefer deckend",
"art": "Holz IV78",
"muster": "fenster",
"rasterMm": [
120,
78
],
"fugeMm": 0,
"farben": [
{
"name": "Weiß RAL 9016",
"hex": "#F1F0EA"
},
{
"name": "Lärche lasiert",
"hex": "#B5814E"
},
{
"name": "Tannengrün RAL 6009",
"hex": "#31372B"
}
],
"hinweis": "Denkmal/Altbau"
},
{
"id": "fenster-holz-alu",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Holz-Alu-Fenster",
"art": "Holz innen, Alu-Deckschale außen",
"muster": "fenster",
"rasterMm": [
110,
90
],
"fugeMm": 0,
"farben": [
{
"name": "außen RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "außen DB 703 Eisenglimmer",
"hex": "#4C4F52"
},
{
"name": "außen RAL 9005 Tiefschwarz",
"hex": "#0E0E10"
},
{
"name": "innen Eiche",
"hex": "#B08A5C"
}
],
"hinweis": "schlanke Alu-Ansicht"
},
{
"id": "fenster-alu",
"gruppe": "Fenster",
"hersteller": "herstellerneutral",
"produkt": "Aluminiumfenster pulverbeschichtet",
"art": "Alu thermisch getrennt",
"muster": "fenster",
"rasterMm": [
95,
75
],
"fugeMm": 0,
"farben": [
{
"name": "RAL 7016 Anthrazitgrau Feinstruktur",
"hex": "#383E42"
},
{
"name": "DB 703 Eisenglimmer",
"hex": "#4C4F52"
},
{
"name": "RAL 9005 Tiefschwarz",
"hex": "#0E0E10"
},
{
"name": "RAL 9006 Weißaluminium",
"hex": "#A5A8A6"
},
{
"name": "RAL 9016 Verkehrsweiß",
"hex": "#F1F0EA"
}
],
"hinweis": "große Glasflächen, schmale Profile"
},
{
"id": "tuer-hoermann-010",
"gruppe": "Haustür",
"hersteller": "Hörmann",
"produkt": "Thermo65 Motiv 010",
"art": "Stahl/Alu",
"design": "glatt",
"muster": "haustuer",
"rasterMm": [
1100,
2100
],
"fugeMm": 0,
"farben": [
{
"name": "Verkehrsweiß RAL 9016",
"hex": "#F1F0EA"
},
{
"name": "Anthrazitgrau RAL 7016",
"hex": "#383E42"
},
{
"name": "CH 703 Anthrazit Metallic",
"hex": "#4A4D50"
},
{
"name": "Decograin Golden Oak",
"hex": "#9A5B2A"
}
],
"hinweis": "ohne Glas, optional Edelstahl-Applikationen"
},
{
"id": "tuer-hoermann-015",
"gruppe": "Haustür",
"hersteller": "Hörmann",
"produkt": "Thermo65 Motiv 015",
"art": "Stahl/Alu",
"design": "lisenen",
"muster": "haustuer",
"rasterMm": [
1100,
2100
],
"fugeMm": 0,
"farben": [
{
"name": "Verkehrsweiß RAL 9016",
"hex": "#F1F0EA"
},
{
"name": "Anthrazitgrau RAL 7016",
"hex": "#383E42"
},
{
"name": "Decograin Night Oak",
"hex": "#3B2F28"
}
],
"hinweis": "ohne Glas, Applikationen als Lisenen"
},
{
"id": "tuer-hoermann-700b",
"gruppe": "Haustür",
"hersteller": "Hörmann",
"produkt": "Thermo65 Motiv 700B",
"art": "Stahl/Alu",
"design": "glasstreifen_seitlich",
"muster": "haustuer",
"rasterMm": [
1100,
2100
],
"fugeMm": 0,
"farben": [
{
"name": "Verkehrsweiß RAL 9016",
"hex": "#F1F0EA"
},
{
"name": "Anthrazitgrau RAL 7016",
"hex": "#383E42"
},
{
"name": "Decograin Dark Oak",
"hex": "#5B3F2C"
}
],
"hinweis": "Glaselement sandgestrahlt mit 7 klaren Streifen"
},
{
"id": "tuer-hoermann-860s",
"gruppe": "Haustür",
"hersteller": "Hörmann",
"produkt": "Thermo65 Motiv 860S",
"art": "Stahl/Alu",
"design": "glasstreifen_seitlich",
"muster": "haustuer",
"rasterMm": [
1100,
2100
],
"fugeMm": 0,
"farben": [
{
"name": "Anthrazitgrau RAL 7016",
"hex": "#383E42"
},
{
"name": "Tiefschwarz RAL 9005",
"hex": "#0E0E10"
}
],
"hinweis": "satiniertes Glas"
},
{
"id": "tuer-hoermann-100-seitenteil",
"gruppe": "Haustür",
"hersteller": "Hörmann",
"produkt": "Thermo65 mit Seitenteil (Motiv 100)",
"art": "Stahl/Alu",
"design": "seitenteil",
"muster": "haustuer",
"rasterMm": [
1600,
2100
],
"fugeMm": 0,
"farben": [
{
"name": "Verkehrsweiß RAL 9016",
"hex": "#F1F0EA"
},
{
"name": "Anthrazitgrau RAL 7016",
"hex": "#383E42"
}
],
"hinweis": "Seitenteil satiniertes Glas, ca. 500 mm breit"
},
{
"id": "tuer-alu-flaechenbuendig",
"gruppe": "Haustür",
"hersteller": "herstellerneutral (z. B. Schüco)",
"produkt": "Alu-Haustür flügelüberdeckend",
"art": "Aluminium",
"design": "glatt",
"muster": "haustuer",
"rasterMm": [
1100,
2200
],
"fugeMm": 0,
"farben": [
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "DB 703 Eisenglimmer",
"hex": "#4C4F52"
},
{
"name": "RAL 9005 Tiefschwarz",
"hex": "#0E0E10"
}
],
"hinweis": "Stangengriff Edelstahl, flächenbündig"
},
{
"id": "tuer-alu-oberlicht",
"gruppe": "Haustür",
"hersteller": "herstellerneutral",
"produkt": "Alu-Haustür mit Oberlicht",
"art": "Aluminium",
"design": "oberlicht",
"muster": "haustuer",
"rasterMm": [
1100,
2600
],
"fugeMm": 0,
"farben": [
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "RAL 9016 Verkehrsweiß",
"hex": "#F1F0EA"
}
],
"hinweis": "Oberlicht ca. 400 mm, Glas klar/satiniert"
},
{
"id": "tuer-holz-eiche",
"gruppe": "Haustür",
"hersteller": "herstellerneutral",
"produkt": "Holz-Haustür Eiche",
"art": "Holz massiv",
"design": "lisenen",
"muster": "haustuer",
"rasterMm": [
1100,
2100
],
"fugeMm": 0,
"farben": [
{
"name": "Eiche natur",
"hex": "#A9824F"
},
{
"name": "Eiche dunkel",
"hex": "#5E4430"
},
{
"name": "Lärche",
"hex": "#B5814E"
}
],
"hinweis": "waagerechte/senkrechte Nuten"
},
{
"id": "tuer-kst-weiss",
"gruppe": "Haustür",
"hersteller": "herstellerneutral",
"produkt": "Kunststoff-Haustür",
"art": "PVC mit Füllung",
"design": "glasstreifen_seitlich",
"muster": "haustuer",
"rasterMm": [
1000,
2100
],
"fugeMm": 0,
"farben": [
{
"name": "Weiß RAL 9016",
"hex": "#F1F0EA"
},
{
"name": "Anthrazit 7016 Außenfolie",
"hex": "#383E42"
},
{
"name": "Golden Oak",
"hex": "#9A5B2A"
}
],
"hinweis": "preisgünstig, Füllung mit Glasstreifen"
},
{
"id": "tuer-alu-seitenteil-glas",
"gruppe": "Haustür",
"hersteller": "herstellerneutral",
"produkt": "Alu-Haustür mit 2 Seitenteilen",
"art": "Aluminium",
"design": "seitenteil",
"muster": "haustuer",
"rasterMm": [
2000,
2100
],
"fugeMm": 0,
"farben": [
{
"name": "RAL 7016 Anthrazitgrau",
"hex": "#383E42"
},
{
"name": "RAL 9005 Tiefschwarz",
"hex": "#0E0E10"
}
],
"hinweis": "symmetrische Anlage, Seitenteile satiniert"
},
{
"id": "dach-braas-rubin13v",
"gruppe": "Dach",
"hersteller": "Braas",
"produkt": "Rubin 13V",
"art": "Tondachziegel Flachdachpfanne",
"muster": "ziegel",
"rasterMm": [
225,
345
],
"fugeMm": 0,
"farben": [
{
"name": "Naturrot",
"hex": "#A94A2E"
},
{
"name": "Kupferrot (Edelengobe)",
"hex": "#8A3B25"
},
{
"name": "Anthrazit (Edelengobe)",
"hex": "#3A3B3D"
},
{
"name": "Tiefschwarz (glasiert)",
"hex": "#1A1B1D"
},
{
"name": "Graphitgrau",
"hex": "#4A4C4F"
}
],
"hinweis": "Deckbreite 225, Decklänge 330-360 mm"
},
{
"id": "dach-braas-taunus",
"gruppe": "Dach",
"hersteller": "Braas",
"produkt": "Taunus Pfanne",
"art": "Betondachstein",
"muster": "ziegel",
"rasterMm": [
300,
330
],
"fugeMm": 0,
"farben": [
{
"name": "Klassisch-Rot",
"hex": "#8E3A2A"
},
{
"name": "Granit",
"hex": "#55585A"
},
{
"name": "Tiefschwarz",
"hex": "#1E1F21"
},
{
"name": "Dunkelbraun",
"hex": "#3E2E26"
},
{
"name": "Schiefergrau",
"hex": "#4A4E52"
}
],
"hinweis": "Deckbreite 300, Decklänge 312-345 mm"
},
{
"id": "dach-erlus-e58max",
"gruppe": "Dach",
"hersteller": "Erlus",
"produkt": "E58 MAX",
"art": "Tondachziegel Großformat",
"muster": "ziegel",
"rasterMm": [
227,
400
],
"fugeMm": 0,
"farben": [
{
"name": "Naturrot",
"hex": "#AE5034"
},
{
"name": "Rot (engobiert)",
"hex": "#943F2A"
},
{
"name": "Anthrazit",
"hex": "#3A3B3D"
},
{
"name": "Diamant schwarz",
"hex": "#1C1D1F"
}
],
"hinweis": "Ziegel ca. 290x465, mittlere Deckbreite 227 mm"
},
{
"id": "dach-creaton-ratio",
"gruppe": "Dach",
"hersteller": "Creaton",
"produkt": "Ratio Großfalz",
"art": "Tondachziegel Flachziegel",
"muster": "ziegel",
"rasterMm": [
270,
390
],
"fugeMm": 0,
"farben": [
{
"name": "Nuance anthrazit engobiert",
"hex": "#3C3D3F"
},
{
"name": "Naturrot",
"hex": "#AA4D30"
}
],
"hinweis": "moderner glatter Flachziegel; Deckmaße ca."
},
{
"id": "dach-creaton-biber",
"gruppe": "Dach",
"hersteller": "Creaton",
"produkt": "Biber Klassik Rundschnitt",
"art": "Biberschwanz Doppeldeckung",
"muster": "schindel",
"rasterMm": [
180,
150
],
"fugeMm": 0,
"farben": [
{
"name": "Naturrot",
"hex": "#AA4D30"
},
{
"name": "Nuance anthrazit engobiert",
"hex": "#3C3D3F"
}
],
"hinweis": "Format 180x380, Lattweite ca. 150 mm"
},
{
"id": "dach-schiefer-altdeutsch",
"gruppe": "Dach",
"hersteller": "Rathscheck",
"produkt": "Moselschiefer Altdeutsche Deckung",
"art": "Naturschiefer",
"muster": "schindel",
"rasterMm": [
250,
200
],
"fugeMm": 0,
"farben": [
{
"name": "Moselschiefer blauschwarz",
"hex": "#2F3238"
}
],
"hinweis": "auch Rechteck-Doppeldeckung InterSIN 40x20"
},
{
"id": "dach-prefa-dachschindel",
"gruppe": "Dach",
"hersteller": "PREFA",
"produkt": "Dachschindel",
"art": "Alu-Schindel",
"muster": "schindel",
"rasterMm": [
420,
240
],
"fugeMm": 0,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Schwarz",
"hex": "#1E1F21"
},
{
"name": "P.10 Braun",
"hex": "#45372F"
},
{
"name": "P.10 Ziegelrot",
"hex": "#8E3B2B"
}
],
"hinweis": "Verlegemaß 420x240 wie Wandschindel"
},
{
"id": "dach-prefa-dachplatte",
"gruppe": "Dach",
"hersteller": "PREFA",
"produkt": "Dachplatte R.16",
"art": "Alu-Dachplatte",
"muster": "schindel",
"rasterMm": [
700,
420
],
"fugeMm": 0,
"farben": [
{
"name": "P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "P.10 Steingrau",
"hex": "#8A8A82"
},
{
"name": "P.10 Schwarz",
"hex": "#1E1F21"
}
],
"hinweis": "Verlegemaß ca. 700x420 (bitte am Datenblatt prüfen)"
},
{
"id": "dach-stehfalz",
"gruppe": "Dach",
"hersteller": "RHEINZINK / PREFA",
"produkt": "Doppelstehfalzdach",
"art": "Metall-Stehfalz",
"muster": "stehfalz",
"rasterMm": [
530,
25
],
"fugeMm": 0,
"farben": [
{
"name": "RHEINZINK prePATINA blaugrau",
"hex": "#8A9196"
},
{
"name": "RHEINZINK prePATINA schiefergrau",
"hex": "#5E6366"
},
{
"name": "Prefalz P.10 Anthrazit",
"hex": "#383E42"
},
{
"name": "Kupfer blank",
"hex": "#B36A3E"
}
],
"hinweis": "Achsmaß ca. 430-580 mm"
},
{
"id": "dach-gruendach",
"gruppe": "Dach",
"hersteller": "herstellerneutral",
"produkt": "Gründach extensiv",
"art": "Sedum-Begrünung",
"muster": "gruendach",
"rasterMm": [
0,
0
],
"fugeMm": 0,
"farben": [
{
"name": "Sedum grün",
"hex": "#6F8A4A"
},
{
"name": "Sedum rötlich",
"hex": "#8A6A4A"
},
{
"name": "Kiesstreifen",
"hex": "#B9B4A8"
}
],
"hinweis": "unregelmäßige Flecken, Kiesrand 50 cm"
},
{
"id": "dach-flach-bitumen",
"gruppe": "Dach",
"hersteller": "herstellerneutral",
"produkt": "Flachdach Bitumen/Kies",
"art": "Bitumenbahn beschiefert oder Kiesschüttung",
"muster": "flach",
"rasterMm": [
1000,
5000
],
"fugeMm": 0,
"farben": [
{
"name": "Bitumen schiefergrau",
"hex": "#4A4C4E"
},
{
"name": "Bitumen schwarz",
"hex": "#262729"
},
{
"name": "Kies 16/32",
"hex": "#A8A39A"
},
{
"name": "EPDM schwarz",
"hex": "#202122"
}
],
"hinweis": "rasterMm = Bahnenbreite/-länge"
}
];
export const GRUPPEN = [...new Set(MATERIALIEN.map(m => m.gruppe))];
export const matById = (id) => MATERIALIEN.find(m => m.id === id);
export const FASSADE_GRUPPEN = ['Putz', 'Klinker', 'Holz', 'Metall', 'Faserzement', 'HPL', 'Naturstein', 'Keramik', 'Glas'];
