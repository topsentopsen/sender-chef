// Sender-Chef: Spieldaten. Alle Titel, Namen und Texte sind frei erfunden.
'use strict';
window.SC = window.SC || {};
(function (SC) {
  SC.VERSION = '0.3.0';
  SC.HOURS = [18, 19, 20, 21, 22, 23, 24]; // 24 = 0 Uhr
  SC.DAY_START = 8 * 60;      // 08:00
  SC.EVENING = 18 * 60;       // 18:00, dann beginnt der Sendeabend
  SC.MIN_PER_SEC = 3;         // Spielminuten pro Echtsekunde bei Tempo 1
  // Potenzielle Zuschauer je Stunde in Tausend
  SC.AUDIENCE = { 18: 3000, 19: 4500, 20: 6500, 21: 7000, 22: 5000, 23: 2800, 24: 1400 };
  SC.OFF = 110;               // Anziehungskraft von "Fernseher bleibt aus"
  SC.BASE_COST = 15000;       // Betriebskosten pro Tag
  SC.FILM_COST = 300;         // Lizenz-/Lagerkosten pro Film und Tag
  SC.INTEREST = 0.01;         // Zinsen pro Tag auf den Kredit
  SC.MAX_ADS = 6;
  SC.SPOTS_PER_DAY = 2;       // höchstens 2 Spots je Vertrag und Abend
  SC.BASE_INCOME = 4;         // Grundeinnahme in Euro je 1000 Zuschauer
  SC.MAX_NEWS = 3;
  SC.PLAYER = { name: 'Welle 7', col: '#ffcc00' };
  SC.RIVALS = [
    { name: 'Blitz TV', col: '#ff4040', qMin: 15, qMax: 42 },
    { name: 'Kanal Krawall', col: '#40d050', qMin: 12, qMax: 48 }
  ];

  // fit = Eignung je Stunde 18..23
  SC.GENRES = {
    action: { name: 'Action', col: '#ff5020', long: true, fit: [0.6, 0.8, 1.1, 1.2, 1.1, 0.8], titles: [
      'Stahlfaust', 'Die Asphaltwölfe', 'Turbo-Kommando', 'Feuer über Duisburg', 'Betonhart', 'Die Nacht der Bulldozer',
      'Kampfzone Kiosk', 'Operation Gummiboot', 'Der Schrottplatz-Rächer', 'Tödliche Bremsspur', 'Zwei Fäuste für Bottrop', 'Explosiv bis Mitternacht'] },
    komoedie: { name: 'Komödie', col: '#ffd020', long: true, fit: [0.9, 1.1, 1.1, 1.0, 0.8, 0.6], titles: [
      'Ärger mit Tante Erna', 'Urlaub auf Balkonien', 'Drei Dackel und ein Baby', 'Der Schwiegervater aus der Hölle', 'Opa Kalle macht Ernst',
      'Hilfe, die Steuerprüferin!', 'Ein Sofa für zwei', 'Die Grillmeister', 'Pommes rot-weiß', 'Chaos im Kleingarten', 'Mein Nachbar, der Zauberer', 'Sonnenbrand inklusive'] },
    drama: { name: 'Drama', col: '#a080ff', long: true, fit: [0.6, 0.8, 1.0, 1.1, 1.0, 0.8], titles: [
      'Schatten über Lindenhof', 'Abschied von Moorbach', 'Die Erbin von Haus Sonnenberg', 'Stille Tage am Fluss', 'Der letzte Sommer', 'Brief ohne Absender',
      'Gegen den Wind', 'Das Schweigen im Dorf', 'Kinder des Kohlenpotts', 'Ein Winter in Lübeck', 'Zeit der Entscheidung', 'Die Glocken von Altenau'] },
    krimi: { name: 'Krimi', col: '#8090a0', long: true, fit: [0.7, 0.9, 1.1, 1.15, 1.05, 0.8], titles: [
      'Mord im Hafen 7', 'Die Akte Gartenzwerg', 'Kommissar Kuhn ermittelt', 'Spurlos in Wanne-Eickel', 'Tod im Zimmer 13', 'Der Nebelmörder',
      'Falsches Spiel in Bad Gramm', 'Die Tote im Taxi', 'Schüsse am Kanal', 'Das Phantom vom Bahnhof', 'Alibi für Fräulein Lenz', 'Nachtschicht für Kowalski'] },
    scifi: { name: 'Science-Fiction', col: '#40e0ff', long: true, fit: [0.7, 0.9, 1.0, 1.1, 1.1, 0.9], titles: [
      'Planet der Pudel', 'Raumstation Kassel', 'Die Roboter von Gamma 5', 'Angriff der Mondmilben', 'Zeitreise nach gestern', 'Sternenkreuzer Hoffnung',
      'Das Ding aus dem Kühlschrank', 'Galaxis in Gefahr', 'Mission Mars-Pommes', 'Die Klonkrieger', 'Strahlenalarm', 'Invasion der Gartenstühle'] },
    horror: { name: 'Horror', col: '#c02020', long: true, fit: [0.3, 0.5, 0.7, 0.9, 1.2, 1.3], titles: [
      'Die Nacht der Kellerasseln', 'Das Haus am Friedhof 3', 'Der Fluch der Tupperdose', 'Blutmond über Hessen', 'Die Zombies vom Baggersee', 'Schrei, wenn du kannst',
      'Der Hausmeister ist tot', 'Spukhotel Edelweiß', 'Die Puppe im Keller', 'Wenn die Uhr dreizehn schlägt', 'Kalte Hände', 'Das Grauen aus dem Gully'] },
    western: { name: 'Western', col: '#d09040', long: true, fit: [0.8, 0.9, 1.0, 0.9, 0.8, 0.6], titles: [
      'Zwei Colts für Kalle', 'Staub über Dry Creek', 'Der Sheriff von Hinterwald', 'Goldrausch am Rhein', 'Ritt nach Westen', 'Die glorreichen Fünf',
      'Der letzte Postkutschenfahrer', 'Rauchzeichen', 'Ein Fremder in Oak Valley', 'Pferdediebe', 'Duell im Morgengrauen', 'Kaktus Joe kehrt zurück'] },
    liebe: { name: 'Liebesfilm', col: '#ff70c0', long: true, fit: [0.7, 1.0, 1.15, 1.05, 0.8, 0.6], titles: [
      'Liebe auf Mallorca', 'Ein Herz für Herbert', 'Küsse im Kornfeld', 'Verliebt in den Briefträger', 'Sommerliebe am Wörthersee', 'Die Ärztin und der Förster',
      'Rosen für Rosi', 'Hochzeit mit Hindernissen', 'Dein Lächeln in Paris', 'Romanze im Regen', 'Zwei Herzen im Dreivierteltakt', 'Flitterwochen im Wohnwagen'] },
    trick: { name: 'Zeichentrick', col: '#60ff60', long: false, fit: [1.3, 1.1, 0.7, 0.5, 0.3, 0.2], titles: [
      'Kalle Krake', 'Die Weltraumhamster', 'Bummi Bär im Zauberwald', 'Pixel und Bit', 'Die kleine Lokomotive Lotte', 'Rabe Rudi',
      'Abenteuer im Sockenland', 'Die Waldwichtel', 'Kapitän Knallbonbon', 'Schnecke Schnell', 'Das Drachenei', 'Fridolin Frosch'] },
    doku: { name: 'Kultur', culture: true, col: '#80c080', long: false, fit: [0.9, 0.8, 0.7, 0.7, 0.7, 0.8], titles: [
      'Wunderwelt Wattenmeer', 'Geheimnis Kanalisation', 'Der Bau der Autobahn', 'Die Welt der Ameisen', 'Mythos Mettbrötchen', 'Vulkane hautnah',
      'Zugvögel', 'Abenteuer Alpen', 'Die Geschichte der Fernbedienung', 'Leben im Eis', 'Megastädte', 'Unser Wald'] },
    show: { name: 'Show', col: '#ff9000', long: false, fit: [0.9, 1.0, 1.05, 0.95, 0.85, 0.9], titles: [
      'Die große Glücksspirale', 'Tanzen mit Toni', 'Das Superquiz', 'Samstagabend-Gala', 'Schlagerparade Spezial', 'Die Hitschmiede',
      'Gewinn oder Gummihuhn', 'Talk um Mitternacht', 'Lachen mit Lothar', 'Der goldene Topf', 'Disco Inferno 87', 'Show der Superlative'] }
  };
  SC.GENRE_IDS = Object.keys(SC.GENRES);
  // 0-Uhr-Spalte ergänzen: Horror und Krimi halten, der Rest schläft ein
  SC.GENRE_IDS.forEach(id => { const f = SC.GENRES[id].fit; f.push(id === 'horror' ? 1.4 : id === 'krimi' || id === 'scifi' ? 0.85 : Math.round(f[5] * 0.7 * 100) / 100); });

  SC.SPONSORS = [
    'Knusperflocken AG', 'Blitzblank Waschmittel', 'Autohaus Rasant', 'Brauerei Schaumkrone', 'Zahnpasta Strahlweiß',
    'Versandhaus Kraxl', 'Bausparkasse Eigenheim', 'Limo Spritzig', 'Möbel Meier', 'Telefonbau Klingel', 'Haarwasser Prachtvoll',
    'Katzenfutter Miezi', 'Reisebüro Fernweh', 'Kaffeerösterei Bohne', 'Schokoladen Schmelz', 'Elektro Funke', 'Weichspüler Wolke',
    'Kaugummi Kau-Kau', 'Versicherung Sorglos', 'Fahrradwerk Flitz'
  ];

  SC.AGENCIES = {
    politik: { name: 'Agentur Politik', fee: 0, cats: ['Politik', 'Wirtschaft', 'Lokales'] },
    showbiz: { name: 'Agentur Showbiz', fee: 4000, cats: ['Klatsch', 'Sport'] },
    vermischt: { name: 'Agentur Vermischtes', fee: 3000, cats: ['Kurioses', 'Tiere', 'Technik', 'Wetter', 'Wissenschaft'] }
  };
  SC.GIFTS = [
    { id: 'blumen', name: 'Blumenstrauß', price: 3000, heart: 5 },
    { id: 'pralinen', name: 'Pralinen', price: 6000, heart: 8 },
    { id: 'parfum', name: 'Parfüm „Nachtfalter“', price: 15000, heart: 14 },
    { id: 'konzert', name: 'Konzertkarten', price: 25000, heart: 20 }
  ];
  SC.LOVE = { name: 'Lena Lichtblick', job: 'Kulturredakteurin' };
  SC.BOSS = { name: 'Direktor Knurrhahn' };
  // t = Titel, c = Kategorie, a = Grundwirkung
  SC.NEWS = [
    { t: 'Bürgermeister fällt in Stadtbrunnen', c: 'Lokales', a: 5 },
    { t: 'Rekordernte bei Salatgurken', c: 'Wirtschaft', a: 2 },
    { t: 'Fußball: Außenseiter schlägt Tabellenführer', c: 'Sport', a: 8 },
    { t: 'Hitzewelle kommt am Wochenende', c: 'Wetter', a: 4 },
    { t: 'Schlagerstar heiratet heimlich', c: 'Klatsch', a: 9 },
    { t: 'Neue Umgehungsstraße eröffnet', c: 'Lokales', a: 2 },
    { t: 'Ufo über Castrop gesichtet?', c: 'Kurioses', a: 7 },
    { t: 'Eisbär-Baby im Zoo geboren', c: 'Tiere', a: 8 },
    { t: 'Steuern steigen schon wieder', c: 'Politik', a: 5 },
    { t: 'Skandal im Rathaus: Spesen für Goldfische', c: 'Politik', a: 10 },
    { t: 'Weltrekord im Bierdeckelstapeln', c: 'Kurioses', a: 6 },
    { t: 'Streik bei der Straßenbahn', c: 'Wirtschaft', a: 4 },
    { t: 'Tennis-Wunderkind gewinnt Turnier', c: 'Sport', a: 7 },
    { t: 'Unwetter: Keller voll Wasser', c: 'Wetter', a: 6 },
    { t: 'Heimcomputer erobern die Kinderzimmer', c: 'Technik', a: 6 },
    { t: 'Prinzessin trägt Gummistiefel', c: 'Klatsch', a: 7 },
    { t: 'Gipfeltreffen ohne Ergebnis', c: 'Politik', a: 3 },
    { t: 'Dackel rettet Feuerwehrmann', c: 'Tiere', a: 9 },
    { t: 'Neues Kaufhaus mit Rolltreppe', c: 'Wirtschaft', a: 3 },
    { t: 'Radrennen endet im Maisfeld', c: 'Sport', a: 6 },
    { t: 'Mondfinsternis heute Nacht', c: 'Wissenschaft', a: 5 },
    { t: 'Tanzverbot im Schwimmbad aufgehoben', c: 'Lokales', a: 4 },
    { t: 'Erfinder baut fliegendes Fahrrad', c: 'Technik', a: 8 },
    { t: 'Preis für Kaffee explodiert', c: 'Wirtschaft', a: 6 }
  ];

  // Hochhaus: Etage 0 = Erdgeschoss. room = Raumschlüssel, deco = nur Dekoration
  SC.FLOORS = [
    { name: 'Erdgeschoss', doors: [{ x: 130, room: 'lobby', label: 'PFÖRTNER' }, { x: 350, room: 'kiosk', label: 'KIOSK' }] },
    { name: '1. Etage', doors: [{ x: 130, room: 'buero', label: 'BÜRO' }, { x: 350, room: 'filme', label: 'FILMHANDEL' }] },
    { name: '2. Etage', doors: [{ x: 130, room: 'werbung', label: 'WERBUNG' }, { x: 350, room: 'rival0', label: 'BLITZ TV', deco: true }] },
    { name: '3. Etage', doors: [{ x: 130, room: 'news', label: 'NACHRICHTEN' }, { x: 350, room: 'rival1', label: 'KRAWALL', deco: true }] },
    { name: '4. Etage', doors: [{ x: 130, room: 'chef', label: 'CHEF' }, { x: 350, room: 'lena', label: 'KULTUR' }] }
  ];

  SC.ROOM_NAMES = {
    lobby: 'Pförtner', buero: 'Büro (Programmplan)', filme: 'Filmhändler', werbung: 'Werbeagentur',
    news: 'Nachrichtenstudio', chef: 'Chef & Kredit', lena: 'Lena (Kultur)', kiosk: 'Kiosk'
  };

  SC.BOSS_TEXT = {
    rank: {
      1: ['Platz eins. Na also. Bilden Sie sich bloß nichts darauf ein.', 'Hm. Ordentliche Quote. Weitermachen, nicht nachlassen!', 'Die Konkurrenz schäumt. So mag ich das.'],
      2: ['Platz zwei ist der erste Verlierer!', 'Mittelmaß! Dafür bezahle ich Sie nicht.', 'Nicht schlecht. Aber auch nicht gut. Eher schlecht.'],
      3: ['Letzter Platz?! Wollen Sie mich ruinieren?', 'Haben Sie überhaupt einen Fernseher zu Hause?', 'Noch so ein Abend und Sie putzen die Aufzüge!']
    },
    empty: 'Und wieso lief bei uns das Testbild?! Testbilder bringen kein Geld!',
    penalty: 'Vertragsstrafen! Die Sponsoren rufen schon bei mir zu Hause an.',
    broke: 'Unser Konto ist im Minus. Die Bank lächelt nicht mehr.',
    lowimage: 'Unser Image ist im Keller. Unter 8 Punkten sind Sie gefeuert, merken Sie sich das!',
    morning: {
      day1: {
        high: 'Sie sind der neue Chef. Läuft ja ganz passabel. Bleibt das so, oder muss ich schreien?',
        mid: 'Neuer Tag, neue Quote. Ich will den ersten Platz sehen. Ab an den Schreibtisch!',
        low: 'Sie sind der neue Chef. Keine Ausreden, keine Testbilder. 18 Uhr geht es los!'
      },
      rank: {
        1: {
          high: 'Gestern Platz eins. Hm. Ordentlich. Heute dasselbe, verstanden?',
          mid: 'Platz eins gestern. Bilden Sie sich nichts ein. An die Arbeit!',
          low: 'Platz eins, und ich bin trotzdem grantig. Ruhen Sie sich nicht auf den Lorbeeren aus!'
        },
        2: {
          high: 'Gestern Platz zwei. Der erste Verlierer. Heute will ich Platz eins!',
          mid: 'Mittelmaß gestern! Dafür bezahle ich Sie nicht. Ran an den Programmplan!',
          low: 'Platz zwei und meine Laune sinkt. Noch so ein Abend, und Sie können packen!'
        },
        3: {
          high: 'Letzter Platz gestern. Unerhört. Heute liefern Sie, oder es knallt!',
          mid: 'Letzter Platz gestern! Wollen Sie mich ruinieren? Heute wird gearbeitet!',
          low: 'Schon wieder Letzter. Die Konkurrenz lacht. Noch ein schlechter Tag, und Sie putzen die Aufzüge!'
        }
      }
    }
  };
})(window.SC);
