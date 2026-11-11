MOTOR NAVIGATIE BENELUX – VERSIE 1.0
======================================

Wat zit erin?
- Grote GPS-snelheidsmeter in km/u
- GPS-locatie
- Bestemming zoeken in Nederland, België en Luxemburg
- Snelste route via OSRM
- Alternatieve/langere route als benadering van een mooiere route
- Tankstations op de kaart via OpenStreetMap (geen actuele brandstofprijzen)
- Mogelijke flitscamera's uit OpenStreetMap
- Stemwaarschuwing (als Android/browser spraak ondersteunt)
- Grote knoppen en mobiel ontwerp

BELANGRIJKE BEPERKINGEN
- Dit is een eerste werkende basisversie, geen vervanging voor professionele motornavigatie.
- De route-engine gebruikt de autorouteprofielen van OSRM. Dit is geen specifiek motorprofiel.
- "Mooie route" kiest de langste gevonden alternatieve route; dit garandeert geen mooie wegen.
- Camera-gegevens uit OpenStreetMap zijn onvolledig en kunnen verouderd zijn. Niet in alle landen zijn waarschuwingen voor alle soorten camera's toegestaan. Controleer lokale regels.
- Internet is nodig voor kaarttegels, adressen, routeberekening en camera-opvraging. GPS-snelheid kan zonder internet werken als GPS beschikbaar is.
- Gebruik navigatie en bedien het scherm alleen veilig en volgens de verkeersregels.

APK MAKEN OP WINDOWS (GRATIS)
1. Installeer Node.js LTS: https://nodejs.org/
2. Installeer Android Studio: https://developer.android.com/studio
3. Pak deze ZIP uit naar bijvoorbeeld C:\MotorNavigatieBenelux
4. Open Opdrachtprompt in die map.
5. Voer uit:
   npm install
   npx cap add android
   npx cap sync android
   npx cap open android
6. Android Studio opent het project. Laat Gradle/SDK-installatie afronden.
   BELANGRIJK VOOR GPS: open android/app/src/main/AndroidManifest.xml.
   Voeg direct binnen <manifest ...> en vóór <application ...> deze regels toe:
      <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
      <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   Sla het bestand op en laat Android Studio synchroniseren.
7. Kies Build > Build Bundle(s) / APK(s) > Build APK(s).
8. Na de build klik je op "locate" om de APK te vinden.
9. Kopieer de APK naar je Android-telefoon en installeer. Sta indien nodig "Installeren van onbekende apps" toe voor de gebruikte bestandsbeheerder.

LOCATIETOESTEMMING
Na installatie: geef de app toestemming voor locatie. Android kan vragen om precieze locatie. Sta dit toe voor GPS.
Als GPS niet werkt: controleer Android-locatie, appmachtiging en test buiten met vrij zicht op de hemel.

OPEN SOURCE / GRATIS DIENSTEN
- OpenStreetMap kaartdata en kaarttegels: https://www.openstreetmap.org/
- Leaflet kaartbibliotheek: https://leafletjs.com/
- OSRM demo-router: https://project-osrm.org/
- Nominatim geocoding: https://nominatim.org/
- Overpass API: https://overpass-api.de/

Let op: publieke demo-servers hebben gebruikslimieten en zijn niet bedoeld voor intensief commercieel gebruik.


APK AUTOMATISCH BOUWEN MET GITHUB ACTIONS
=========================================
Deze ZIP bevat .github/workflows/build-apk.yml.
1. Maak op GitHub een NIEUWE repository, bijvoorbeeld Motor-Navigatie-Benelux.
2. Pak de ZIP uit op Windows.
3. Upload ALLE bestanden en mappen uit de uitgepakte map naar de hoofdmap (root) van de GitHub-repository. Neem ook de verborgen map .github mee.
4. Klik Commit changes.
5. Open in GitHub het tabblad Actions.
6. Open "Build Motor Navigatie Benelux APK".
7. Wacht tot alle stappen groen zijn.
8. Open de geslaagde workflow-run. Onderaan bij Artifacts staat:
   Motor-Navigatie-Benelux-debug-APK
9. Download de artifact ZIP en pak die uit. Daarin staat app-debug.apk.
10. Kopieer app-debug.apk naar je Android-telefoon en installeer deze.

De workflow maakt een debug/test-APK. Dit is geen Play Store-release.
GitHub Actions heeft gebruikslimieten; voor een publieke repository is de basisworkflow doorgaans gratis binnen de actuele GitHub-limieten.
