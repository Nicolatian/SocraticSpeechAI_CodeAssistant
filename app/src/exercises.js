export const exercises = {
  'array-indexing': {
    label: 'Array indexing',
    starterCode: `# Five consecutive ECG measurements (mV)
ecg = [0.1, 0.3, 0.8, 0.4, 0.2]

# Get the third measurement
measurements = ecg[3]

print("Third ECG measurement:", third_measurement)
`,
exercisePrompt: 'Make the program print the third ECG measurement.',
teacherNotes: {
  concept: 'Lister i Python er nulindekseret: den første plads har nummer 0, så den tredje måling ligger ikke på plads 3.',
  knownIssues: [
    'Navnet på variablen, hvor målingen gemmes, er ikke det samme som navnet i linjen, der printer. Det giver en fejlmeddelelse, når programmet køres.',
    'Indekset i linjen, der henter målingen, vælger den fjerde måling i stedet for den tredje, fordi Python tæller fra 0.',
    'Eleven vil typisk støde på fejlmeddelelsen først og først bagefter opdage, at værdien er forkert.',
  ],
  hintLadder: [
    'Bed eleven køre programmet og beskrive med egne ord, hvad der sker, og hvad fejlmeddelelsen siger.',
    'Spørg, hvilket navn fejlmeddelelsen nævner, og bed eleven sammenligne den linje, hvor målingen gemmes, med den linje, hvor den printes.',
    'Når programmet kører: spørg, hvilken værdi eleven forventer at se, og hvilken værdi der faktisk bliver printet.',
    'Spørg, hvordan Python nummererer pladserne i en liste, og hvilket nummer den første plads har.',
    'Bed eleven pege på linjen, der henter målingen, og tælle sig frem i listen med Pythons nummerering for at finde ud af, hvilket nummer den tredje måling har.',
  ],
},
explanation:
  'Your goal is to make the program display the third ECG measurement',
  },
  'for-loops': {
    label: 'For loops',
    starterCode: `# Five EMG measurements (mV)
EMG = [0.2, 0.4, 0.6, 0.3, 0.5, 0.6]
  
# Calculate the sum of all measurements
total = 0

for i in range (3) :
  total = total + eng [i]
  
print ("Total EMG:" , totals)
    `,

    exercisePrompt: 'Make the program calculate the sum of all EMG measurements.',
    teacherNotes: {
      concept: 'En for-løkke gentager en blok kode et bestemt antal gange. Antallet af gentagelser skal passe til antallet af elementer i listen, hvis alle skal tælles med.',
      knownIssues: [
        'Navnet på listen i løkken er stavet anderledes end der, hvor listen oprettes. Python skelner mellem store og små bogstaver.',
        'Navnet på summen i print-linjen er ikke det samme som navnet, der bruges i løkken.',
        'Løkken kører kun et fast, for lavet antal gange, så ikke alle målinger bliver talt med.',
        'Kommentaren siger fem målinger, men listen har seks. Hvis eleven undrer sig, så lad eleven selv tælle listen. Afslør ikke den rigtige sum.',
        'Flere løsninger er korrekte, fx at tælle listens længde eller at gå direkte gennem listen. Accepter enhver løsning, der tæller alle målinger med.',
      ],
      hintLadder: [
        'Bed eleven køre programmet og fortælle, hvad fejlmeddelelsen siger.',
        'Tag ét navn ad gangen: spørg, hvilket navn fejlmeddelelsen nævner, og bed eleven sammenligne stavemåden med der, hvor navnet bliver oprettet.',
        'Når programmet kører uden fejl: bed eleven lægge tallene i listen sammen i hovedet og sammenligne med det, programmet printer.',
        'Spørg, hvor mange gange løkken kører, og hvor mange målinger listen har.',
        'Spørg, hvad i løkkens første linje bestemmer antallet af gentagelser, og om eleven kan få programmet til selv at finde antallet af målinger i stedet for at skrive et fast tal.',
      ],
    },
    explanation: 'Your goal is to make the program calculate the sum of all EMG measurements.',
  },
  'conditional-statements': {
    label: 'Conditional statements',
    starterCode: `# EMG measurement (mV)
emg = 0.7

# Threshold for high muscle activity
threshold = 0.5

# Check muscle activity
if emg < threshold:
    print("High muscle activity")
else:
    print("Low muscle activity")`,
    exercisePrompt: 'Make the program print "High muscle activity" when the EMG measurement is above the threshold.',
    teacherNotes: {
  concept: 'En if/else-sætning vælger en gren ud fra, om betingelsen er sand. Sammenligningstegn som større end og mindre end giver modsatte resultater.',
  knownIssues: [
    'Programmet kører uden fejl, men printer den forkerte besked, fordi sammenligningen i betingelsen går den modsatte vej af det, opgaven beder om.',
    'Hvis eleven i stedet bytter de to beskeder, bliver outputtet rigtigt for netop denne værdi, men logikken passer stadig ikke til opgaven. Spørg, hvad der sker, hvis målingen ændres til en anden værdi.',
    'Eleven kan tro, at fejlen er i tallene eller i beskederne, selvom den ligger i selve sammenligningen.',
  ],
  hintLadder: [
    'Bed eleven køre programmet og sige, hvad der printes, og om det er det, eleven forventer.',
    'Spørg, hvilke værdier målingen og grænsen har, og om målingen er over eller under grænsen.',
    'Bed eleven læse betingelsen i if-linjen op med ord og sige, hvornår den er sand.',
    'Spørg, hvilken af de to beskeder programmet vælger, og om det er den, opgaven beder om.',
    'Bed eleven pege på sammenligningstegnet i betingelsen og sige, om det betyder større end eller mindre end, og om det passer til opgaven.',
  ],
},
    explanation: 'Your goal is to make the program print "High muscle activity" when the EMG measurement is above the threshold.',
  },
}
