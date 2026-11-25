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
verificationCriteria: [
      'The program must retrieve the third ECG measurement from the ecg list.',
      'The program must use the correct Python list index, which is index 3.',
      'The retrieved measurement must have the value 0.4.',
      'The program output must contain: Third ECG measurement: 0.4.',
      'The retrieved measurement must be printed.',
      'The program must execute without errors.'
    ],
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
export const exercisesByCategory = {
  'array-indexing': [
    exercises['array-indexing'],
    {
      label: 'Multidimensional ECG indexing',
      starterCode: `# Two ECG recordings
ecg = [
    [0.1, 0.3, 0.8, 0.4, 0.2],
    [0.2, 0.4, 0.7, 0.5, 0.3],
]

measurement = ecg[1][0]
print("Measurement:", measurement)
`,
      exercisePrompt: 'Print the third measurement from the second ECG recording.',
      explanation: 'Your goal is to retrieve the third measurement from the second ECG recording.',
      teacherNotes: {
        concept: 'I en liste af lister vælger det første indeks den indre liste. Det næste indeks vælger et element i den liste. Begge indekser starter ved nul.',
        knownIssues: [
          'Det første indeks vælger allerede den anden optagelse.',
          'Det andet indeks vælger den første måling i optagelsen, selvom opgaven beder om den tredje.',
          'Eleven kan komme til at ændre begge indekser, fordi de to indeksers roller bliver blandet sammen.',
        ],
        hintLadder: [
          'Bed eleven køre koden og finde den viste værdi i en af optagelserne.',
          'Spørg, hvad ecg[1] ville give, hvis de fjernede den sidste kantede parentes med indeks.',
          'Bed eleven tælle målingerne i den valgte optagelse med Pythons nummerering.',
          'Spørg, hvilket af de to indekser der skal ændres, og hvorfor det andet kan blive stående.',
        ],
      },
    },
    {
      label: 'ECG time interval',
      starterCode: `# ECG measurements taken twice per second, starting at 0 seconds
ecg = [0.1, 0.3, 0.8, 0.4, 0.2, 0.7, 0.5, 0.3]
samples_per_second = 2

start_time = 2
end_time = 3

start_index = start_time
end_index = end_time

selected = ecg[start_index:end_index + 1]
print("Selected measurements:", selected)
`,
      exercisePrompt: 'Print the ECG measurements from 2.0 through 3.0 seconds, including both endpoints.',
      explanation: 'The recording starts at 0 seconds and contains two samples per second. Select the measurements at 2.0, 2.5, and 3.0 seconds.',
      teacherNotes: {
        concept: 'Tid i sekunder omregnes til et listeindeks ved hjælp af antallet af målinger pr. sekund. En Python-slice inkluderer startindekset og stopper før slutgrænsen.',
        knownIssues: [
          'Start- og sluttid bruges direkte som listeindekser. Med to målinger pr. sekund passer de indekser til et tidligere tidsinterval.',
          'Udtrykket end_index + 1 er allerede nødvendigt for at få målingen ved sluttidspunktet med.',
          'Eleven kan rette startindekset og glemme at omregne slutindekset.',
        ],
        hintLadder: [
          'Spørg, hvor mange målinger eleven forventer mellem 2,0 og 3,0 sekunder, når begge endepunkter tæller med.',
          'Bed eleven sætte tidspunkter på de første tre målinger, når optagelsen starter ved 0 sekunder.',
          'Spørg, hvordan samples_per_second kan bruges til at finde indekset for både start- og sluttid.',
          'Bed eleven forklare, hvad der ville ske med den sidste måling, hvis de fjernede + 1 fra slicen.',
        ],
      },
    },
  ],

  'for-loops': [
    exercises['for-loops'],
    {
      label: 'EMG accumulation',
      starterCode: `emg = [0.2, 0.4, 0.6, 0.3, 0.5]

total = 0
for measurement in emg:
    total = measurement

average = total / len(emg)
print("Average EMG:", average)
`,
      exercisePrompt: 'Fix the loop so all five EMG measurements contribute to the average.',
      explanation: 'Your goal is to calculate the average of all five EMG measurements.',
      teacherNotes: {
        concept: 'En akkumulator gemmer en løbende sum. I hver iteration bruges den tidligere sum til at beregne den nye sum.',
        knownIssues: [
          'Linjen total = measurement overskriver summen i hver iteration.',
          'Efter løkken indeholder total kun den sidste måling. Divisionen bruger allerede listens længde.',
          'Eleven kan forsøge at ændre divisionen, selvom fejlen opstår, mens løkken opdaterer total.',
        ],
        hintLadder: [
          'Bed eleven køre programmet og sammenligne resultatet med det gennemsnit, de forventer.',
          'Spørg, hvad total indeholder efter den første og den anden iteration.',
          'Spørg, hvor den første måling bliver af, når den anden måling gemmes i total.',
          'Bed eleven beskrive, hvordan næste iteration både kan bruge den tidligere sum og den nye måling.',
        ],
      },
    },
    {
      label: 'EMG interval averages',
      starterCode: `intervals = [
    [0.2, 0.4, 0.6],
    [0.3, 0.5, 0.4],
    [0.6, 0.2, 0.2],
]

averages = []
total = 0

for interval in intervals:
    for measurement in interval:
        total = total + measurement

    average = total / len(interval)
    averages.append(round(average, 4))

print("Interval averages:", averages)
`,
      exercisePrompt: 'Calculate a separate average for each EMG interval.',
      explanation: 'Your goal is to print one average per interval, using only the measurements in that interval.',
      teacherNotes: {
        concept: 'Den ydre løkke vælger et interval, og den indre løkke gennemgår målingerne i intervallet. Summen skal begynde ved nul for hvert nyt interval.',
        knownIssues: [
          'Total sættes til nul én gang før den ydre løkke, så summen fra det første interval følger med ind i det næste.',
          'Det første gennemsnit kan være korrekt, selvom de næste gennemsnit bliver for høje.',
          'Hvis eleven nulstiller total i den indre løkke, mister de summen ved hver ny måling.',
        ],
        hintLadder: [
          'Bed eleven sammenligne de to første gennemsnit med det, de får ved at beregne hvert interval for sig.',
          'Spørg, hvilken løkke der skifter interval, og hvilken der skifter måling.',
          'Bed eleven følge værdien af total lige før løkken starter på det andet interval.',
          'Spørg, hvor total kan nulstilles præcis én gang pr. interval.',
        ],
      },
    },
  ],

  'conditional-statements': [
    exercises['conditional-statements'],
    {
      label: 'High EMG measurements',
      starterCode: `emg = [0.2, 0.5, 0.8, 0.6, 0.9]
threshold = 0.7

for measurement in emg:
    if measurement < threshold:
        print("High muscle activity:", measurement)
`,
      exercisePrompt: 'Print only the EMG measurements that are strictly above the threshold.',
      explanation: 'Your goal is to print each EMG measurement above the threshold. A measurement equal to the threshold should be left out.',
      teacherNotes: {
        concept: 'Løkken gennemgår alle målinger. If-betingelsen afgør for hver måling, om den skal udskrives.',
        knownIssues: [
          'Sammenligningen vælger målinger under grænsen, selvom opgaven beder om målinger over den.',
          'En sammenligning, der også accepterer lighed, ville give det samme output med den viste liste, fordi ingen måling er præcis lig med grænsen.',
          'Løkken gennemgår allerede hele listen. Det er betingelsen, der skal rettes.',
        ],
        hintLadder: [
          'Bed eleven forudsige, hvilke målinger der bør vises, og derefter køre programmet.',
          'Spørg, hvad if-betingelsen betyder med ord.',
          'Bed eleven følge én måling under grænsen og én over grænsen gennem betingelsen.',
          'Spørg, hvad der skal ske med en måling på præcis 0,7, hvis den tilføjes til listen.',
        ],
      },
    },
    {
      label: 'EMG activity ranges',
      starterCode: `emg = [0.1, 0.2, 0.4, 0.5, 0.8, 0.9]

lower_threshold = 0.3
upper_threshold = 0.7

for measurement in emg:
    if measurement < lower_threshold:
        print("Low activity")
    elif measurement <= lower_threshold:
        print("Normal activity")
    else:
        print("High activity")
`,
      exercisePrompt: 'Print "Low activity" below 0.3, "Normal activity" from 0.3 through 0.7, and "High activity" above 0.7.',
      explanation: 'Classify each measurement as low, normal, or high. Both threshold values count as normal.',
      teacherNotes: {
        concept: 'Python afprøver if og elif i rækkefølge og vælger den første sande gren. Når elif nås, ved vi allerede, at målingen ikke er under den nedre grænse.',
        knownIssues: [
          'Elif sammenligner med den nedre grænse igen, så de viste værdier i normalområdet ender i else-grenen.',
          'Den øvre grænse er defineret, men bruges ikke i betingelsen.',
          'En løsning med en streng øvre grænse ville klassificere 0,7 som høj, selvom opgaven siger, at den tæller som normal.',
        ],
        hintLadder: [
          'Bed eleven vælge en måling midt i normalområdet og forudsige dens kategori.',
          'Bed eleven følge målingen gennem if og elif og fortælle, hvor den ender.',
          'Spørg, hvad vi allerede ved om målingen, når den første betingelse er falsk.',
          'Spørg, hvilken grænse elif stadig skal tjekke, og hvordan præcis 0,3 og 0,7 bør klassificeres.',
        ],
      },
    },
  ],
}
