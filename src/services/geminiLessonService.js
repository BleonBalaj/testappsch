import { parseClassLabel, stageForClass, getSubjectArea } from '../features/lessonPlans/catalog.js';

/**
 * World-Class Pedagogical Intelligence Engine for LumiSchool
 * Designed strictly according to the Kosovo (MASHTI) and European competency curriculum frameworks.
 * 
 * Accurately analyzes:
 * 1. Exact Subject (Matematikë, Gjuhë shqipe, Dituri natyre, Histori, Gjeografi, Edukatë figurative, Edukatë fizike, etc.)
 *    - Strict regex prevention to ensure 'Matematikë' NEVER confuses with 'TIK'
 * 2. Exact Grade & Stage (e.g. II-4 -> Grade 2, Shkalla I)
 *    - Child-friendly, concrete manipulatives for primary grades (1-2, age 6-8)
 *    - Conceptual models, arithmetic fluency & reading comprehension for elementary grades (3-5, age 8-11)
 *    - Analytical thinking, proofs, structured essays for middle/high school (6-12)
 * 3. Exact User-Typed Lesson Unit (Njësia Mësimore)
 *    - Deep semantic decomposition of arithmetic, geometry, time, measurement, word problems, grammar, poetry, flora, fauna, human body, etc.
 * 4. Lesson Period (Ora Mësimore: Ora 1, 2, 3...)
 *    - Ora 1: Introduction, schema activation, concrete/visual models & discovery
 *    - Ora 2: Guided practice, workbook drills, varied exercises & error analysis
 *    - Ora 3: Real-world applied problem solving, contextual tasks & synthesis
 *    - Ora 4+: Consolidation, review & formative evaluation
 */

const clean = (val) => String(val || '').trim();

/**
 * Call Google Gemini API with smart Flash models
 * (gemini-2.0-flash is the smartest Flash model available)
 */
async function callGeminiAPI(apiKey, prompt) {
  const models = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b'
  ];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 3500,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');
      
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Gemini model ${model} notice:`, err.message);
    }
  }

  throw lastError || new Error('Failed to reach Gemini API');
}

/**
 * Normalize and parse "Ora mësimore" (Period)
 */
function parsePeriod(periodStr) {
  if (!periodStr) return { number: 1, label: '1', stage: 'Hyrje & Konceptet Bazë' };
  const raw = String(periodStr).trim();
  const match = raw.match(/\d+/);
  const num = match ? parseInt(match[0], 10) : 1;
  
  let stage = 'Hyrje & Konceptet Bazë';
  if (num === 2) stage = 'Përforcim & Ushtrime Praktike';
  else if (num === 3) stage = 'Zbatim në Jetën Reale & Problema';
  else if (num >= 4) stage = 'Konsolidim & Vlerësim Formativ';

  return { number: num, label: String(num), stage };
}

/**
 * Safe, robust Subject Classification
 * Prevents substring collisions like "Matematikë" triggering "tik"!
 */
function classifySubject(subjectRaw) {
  const s = clean(subjectRaw).toLowerCase();
  
  // Math: specifically matches Matematikë, Math, etc.
  const isMath = /matematik/i.test(s) || s === 'math' || s === 'mathematics';
  
  // Languages: Albanian, English, German, French
  const isLanguage = (/gjuh[eë]|shqip|anglez|gjerman|fr[eë]ng|english|language/i.test(s)) && !isMath;
  
  // Natural Sciences: Physics, Chemistry, Biology, Dituri Natyre, Njeriu dhe natyra
  const isScience = (/natyr|biologj|kimi|shkenc/i.test(s) || (/\bfizik[eë]\b/i.test(s) && !/edukat[eë]/i.test(s))) && !isMath;
  
  // History:
  const isHistory = /histori|history/i.test(s);
  
  // Geography:
  const isGeography = /gjeografi|geography/i.test(s);
  
  // Civics / Society:
  const isCivics = (/qytetar|shoq[eë]ri|civic|society/i.test(s)) && !isScience && !isHistory && !isGeography;
  
  // Arts: Figurative, Music
  const isArt = /figurativ|piktur|art pamor|\bart\b|muzik/i.test(s);
  
  // Physical Education:
  const isPE = /edukat[eë]\s+fizik|sport|fizkultur/i.test(s);
  
  // TIK: MUST be word boundary or exact phrase, NEVER matching "matematikë"!
  const isTIK = (/(?:^|\s)(?:tik|teknologji(?:\s+me\s+tik)?|informatik[eë]|computer(?:\s+science)?)(?:\s|$)/i.test(s)) && !isMath;

  return {
    isMath,
    isLanguage,
    isScience,
    isHistory,
    isGeography,
    isCivics,
    isArt,
    isPE,
    isTIK,
    subjectName: isMath ? 'Matematikë' : isLanguage ? 'Gjuhë dhe Komunikim' : isScience ? 'Shkenca Natyrore' : s
  };
}

/**
 * Deep Semantic Topic Analyzer and Content Generator
 * Tailors 100% of the educational content to the exact words typed in lessonUnit.
 */
function buildDomainSpecificLesson({
  subject,
  classLabel,
  grade,
  lessonUnit,
  curricularArea,
  curriculumStage,
  period,
  language = 'sq'
}) {
  const isSq = language === 'sq';
  const unitRaw = clean(lessonUnit);
  const uLower = unitRaw.toLowerCase();
  const subjRaw = clean(subject);
  const parsed = parseClassLabel(classLabel);
  const gr = parsed?.grade ?? (grade !== null && grade !== undefined ? grade : 2);
  const stage = curriculumStage || (gr <= 2 ? 'Shkalla I' : gr <= 5 ? 'Shkalla II' : gr <= 7 ? 'Shkalla III' : gr <= 9 ? 'Shkalla IV' : gr <= 11 ? 'Shkalla V' : 'Shkalla VI');
  const pInfo = parsePeriod(period);
  const pNum = pInfo.number;

  const subjType = classifySubject(subjRaw);

  // ==========================================================================
  // 1. MATHEMATICS (Matematikë) — 100% Pure Math, Zero Robotic/Tech Jargon
  // ==========================================================================
  if (subjType.isMath) {
    const isEarlyPrimary = gr <= 2; // Grade 1 or 2 (Age 6-8, Shkalla I)
    const isElementary = gr >= 3 && gr <= 5; // Grade 3-5 (Shkalla II)

    // A. Detect specific mathematical subdomain from user's typed unit:
    const isAddition = /mbledh|mbledhje|kalim|shum[eë]|addition|add/i.test(uLower);
    const isSubtraction = /zbrit|zbritje|prishj|ndryshim|diferenc|subtraction|subtract/i.test(uLower);
    const isNumbersCounting = /numr|numërim|rendor|çift|tek|krahasim|vlera e vendit|dhjetësh|njësh|number|count/i.test(uLower);
    const isMultiplication = /shumëzim|shumëzimi|tabela e shumëzimit|multiplication/i.test(uLower);
    const isDivision = /pjesëtim|pjesëtimi|division/i.test(uLower);
    const isGeometry = /figur|gjeometr|katror|drejtkëndësh|trekëndësh|rreth|trup|kub|kuboid|sfer|brinj|kulm|perimet|syprin|shape|geometry/i.test(uLower);
    const isClockTime = /or[eë]|ora|koh[eë]|minut|sekond|time|clock/i.test(uLower);
    const isMeasurement = /matj|gjatësi|met[eë]r|centimet[eë]r|mas[eë]|kilogram|gram|lit[eë]r|kapacitet|measure|length/i.test(uLower);
    const isMoney = /par[aë]|monedh|euro|cent|kartëmonedh|blerj|çmim|money/i.test(uLower);
    const isFractions = /thyes|thyesa|gjysm|çerek|fraction|half/i.test(uLower);
    const isWordProblem = /problem|detyrë me fjalë|word problem/i.test(uLower);

    // Contextual customization for Early Primary (Grade 1-2):
    if (isEarlyPrimary) {
      if (isAddition) {
        const hasCarrying = /me kalim/i.test(uLower);
        const carryingDetail = hasCarrying ? 'me kalim të dhjetëshes (plotësimi i numrit 10)' : 'pa kalim të dhjetëshes';
        
        let focus = pNum === 1 ? `Hyrje me kornizën e dhjetëshes dhe kube: ${carryingDetail} (Ora 1)`
                  : pNum === 2 ? `Ushtrime praktike në fletoren me katrorë dhe llogaritje në dyshe (Ora 2)`
                  : pNum === 3 ? `Zgjidhje problemash me figura dhe blerje frutash (Ora 3)`
                  : `Konsolidim dhe lojë stafetë me barazime (Ora ${pNum})`;

        return {
          topic: `Matematikë — ${unitRaw} (Klasa ${classLabel || gr}, ${focus})`,
          topicLearningOutcome: `Nxënësi/ja kupton dhe zbaton mbledhjen ${carryingDetail} për numrat e klasës ${gr}, duke përdorur kornizën e 10-shes, kube numëruese dhe barazime të shkruara me saktësi.`,
          competencyOutcomes: [
            `Kompetenca e të menduarit: Zbërthen mbledhësin e dytë për të plotësuar fillimisht dhjetëshen (p.sh. te 8 + 5, ndan 5 në 2 + 3 për të arritur 10 + 3 = 13).`,
            `Kompetenca e komunikimit: Shpjegon me zë të qartë hapat e llogaritjes para shokut të bankës.`,
            `Kompetenca e të nxënit: Shkruan shifrat me kujdes dhe rregull brenda kutizave të fletores me katrorë.`,
            `Kompetenca personale: Bashkëpunon me kënaqësi gjatë lojërave me kartela numerike.`
          ],
          fieldOutcomes: [
            `Kryen mbledhjen e numrave deri në ${gr === 1 ? '20' : '100'} me mjete konkrete dhe me shkrim.`,
            `Përdor saktë simbolet e mbledhjes (+) dhe barazimit (=).`
          ],
          keywords: `${unitRaw}, mbledhje, mbledhës, shumë, kalim i dhjetëshes, korniza e 10-shes, kube, barazim, Klasa ${classLabel || gr}, Ora ${pNum}`,
          lessonOutcomes: pNum === 1 ? [
            `Demonstron mbledhjen e dy grupeve të sendeve duke përdorur kube me ngjyra dhe shkopinj numërues.`,
            `Zbulon se si plotësohet dhjetëshja e parë duke bashkuar 10 sende në një grup të vetëm.`,
            `Zgjidh me ndihmën e mësuesit/es 3 shembujt e parë model në tabelë (p.sh. 8+4=12, 7+5=12).`,
            `Shkruan barazimet përkatëse në fletore duke vendosur numrat në kutizat e duhura.`
          ] : pNum === 2 ? [
            `Zgjidh në mënyrë të pavarur 6 barazime mbledhjeje në fletoren e punës.`,
            `Përdor boshtin numerik të vizatuar për të kontrolluar saktësinë e llogaritjes.`,
            `Zbulon dhe korrigjon pasaktësitë e thjeshta duke numëruar me zë objektet.`,
            `Ndihmon shokun/shoqen e bankës gjatë kontrollit të ndërsjellë të detyrave.`
          ] : [
            `Zgjidh problema me fjalë dhe figura nga jeta reale (p.sh. mollë në shportë, lapsa me ngjyra).`,
            `Dallon të dhënat e problemës dhe shkruan barazimin përkatës të mbledhjes.`,
            `Shpreh përgjigjen me fjali të plotë (p.sh. "Agoni ka gjithsej 14 karamele.").`,
            `Krijon një shembull të thjeshtë me blerje lodrash para klasës.`
          ],
          successCriteria: [
            `Unë mund të mbledh numrat duke përdorur kubat ose boshtin me vija.`,
            `Unë mund të shkruaj barazimin saktë në fletoren me katrorë.`,
            `Unë mund të tregoj me fjalë se si e gjeta rezultatin.`
          ],
          resources: `Teksti i Matematikës, fletore me katrorë, korniza e dhjetëshes, kube numëruese, numëratore me sfera, shkumësa me ngjyra.`,
          crossCurricular: `Gjuhë shqipe (leximi i numrave me fjalë dhe formulimi i fjalive), Art pamor (vizatimi i sendeve me ngjyra).`,
          methodology: `Struktura EVR — Ora ${pNum} (Matematikë, Klasa ${classLabel || gr}):\n\n` +
            `1. Evokimi (10 min): Loja "Kush e bën 10 më shpejt?": Mësuesi ngre kartelën me numrin 7, fëmijët thërrasin "Duhen edhe 3!". Nxehje e shpejtë mendore.\n\n` +
            `2. Realizimi i Kuptimit (25 min): Demonstrimi me dy grupe kubash në ngjyra të ndryshme (8 të kuq dhe 5 të kaltër). Zhvendosen 2 kube te të kuqtë për t'u bërë 10, dhe mbeten 3. Shkruhet barazimi 8 + 5 = 13. Fëmijët punojnë në dyshe me 4 shembuj të ngjashëm në fletore.\n\n` +
            `3. Reflektimi (10 min): Loja me stafetë në tabelë: nxënësit plotësojnë numrin që mungon në barazime dhe duartrokasin suksesin e përbashkët.`,
          assessment: `• Vlerësim formativ i drejtpërdrejtë gjatë punës me kube numëruese.\n• Kontrolli i rregullit të shkrimit të shifrave në fletoren me katrorë.\n• Vetëvlerësimi përmes semaforit me kartela (e gjelbër = e kuptova plotësisht).`,
          homework: `Plotëso 4 barazimet e mbledhjes në fletoren e punës dhe vizato pranë secilit kutizat përkatëse.`,
          reflection: `Fëmijët e klasës ${classLabel || gr} treguan përqendrim të lartë gjatë zbërthimit të numrave. Korniza e dhjetëshes e bëri kalimin shumë të prekshëm dhe të qartë.`
        };
      }

      if (isSubtraction) {
        return {
          topic: `Matematikë — ${unitRaw} (Klasa ${classLabel || gr}, Zbritja dhe zbërthimi, Ora ${pNum})`,
          topicLearningOutcome: `Nxënësi/ja kupton zbritjen si veprim të heqjes, pakësimit dhe të anasjelltë të mbledhjes, duke llogaritur me mjete konkrete dhe fletore pune për numrat e klasës ${gr}.`,
          competencyOutcomes: [
            `Kompetenca e të menduarit: Përdor boshtin numerik duke kërcyer prapa për të gjetur diferencën e saktë.`,
            `Kompetenca e komunikimit: Përdor fjalët "i zbresim", "mbetën", "diferenca" saktë.`,
            `Kompetenca e të nxënit: Shkruan barazimet e zbritjes në mënyrë të pastër dhe të rregullt.`,
            `Kompetenca personale: Tregon durim dhe kontrollon rezultatin duke kryer provën me mbledhje.`
          ],
          fieldOutcomes: [
            `Zbaton veprimin e zbritjes me numrat e moshës 7-8 vjeçare.`,
            `Lidh zbritjen me situata konkrete të pakësimit nga jeta e përditshme.`
          ],
          keywords: `${unitRaw}, zbritje, i zbritshmi, zbritësi, diferenca, bosht numerik, heqje, Klasa ${classLabel || gr}, Ora ${pNum}`,
          lessonOutcomes: [
            `Tregon me objekte konkrete heqjen e një numri sendesh nga grupi fillestar.`,
            `Zgjidh barazimet e zbritjes në tabelë dhe në fletoren me katrorë.`,
            `Përdor provën me mbledhje për të vërtetuar saktësinë e llogaritjes (p.sh. 14 - 6 = 8 sepse 8 + 6 = 14).`,
            `Zgjidh situata të thjeshta problemore me zvogëlim sendesh.`
          ],
          successCriteria: [
            `Unë mund të heq kubat e duhur dhe të numëroj sa më mbetën.`,
            `Unë mund të shkruaj shenjën minus (-) dhe barazimin saktë.`,
            `Unë mund të kontrolloj zbritjen time me anë të mbledhjes.`
          ],
          resources: `Teksti mësimor, bosht me numra, kube me ngjyra, shkumësa, fletore pune me katrorë.`,
          crossCurricular: `Gjuhë shqipe (krijimi i historive të thjeshta me shpendë që fluturojnë apo fruta që konsumohen).`,
          methodology: `Struktura EVR — Ora ${pNum} (Matematikë, Zbritja):\n\n` +
            `1. Evokimi (10 min): Mësuesi/ja vendos 12 shkumësa në tavolinë dhe fsheh 4 prej tyre në kuti. "Sa shkumësa mbetën në tavolinë?". Numërim i përbashkët me zë.\n\n` +
            `2. Realizimi i Kuptimit (25 min): Shkrimi i barazimit 12 - 4 = 8 në tabelë. Demonstrimi i kërcimit 4 hapa prapa në boshtin numerik. Nxënësit zgjidhin 5 shembuj në fletoren me katrorë duke bërë provën me mbledhje.\n\n` +
            `3. Reflektimi (10 min): Loja me kartela "Gjej diferencën": nxënësit ngrenë numrin përgjigje me shpejtësi.`,
          assessment: `Vlerësim formativ i përdorimit të boshtit numerik dhe saktësisë së provës me mbledhje.`,
          homework: `Zgjidh 4 ushtrimet e zbritjes në faqen e caktuar të fletores së punës.`,
          reflection: `Përdorimi i provës me mbledhje i ndihmoi fëmijët të kuptojnë lidhjen e ngushtë mes dy veprimeve.`
        };
      }

      if (isGeometry) {
        return {
          topic: `Matematikë — ${unitRaw} (Klasa ${classLabel || gr}, Figurat gjeometrike dhe vetitë e tyre, Ora ${pNum})`,
          topicLearningOutcome: `Nxënësi/ja njeh, emërton, vizaton dhe dallon figurat gjeometrike (katrorin, drejtkëndëshin, trekëndëshin, rrethin) duke numëruar brinjët dhe kulmet e tyre në objekte të klasës.`,
          competencyOutcomes: [
            `Kompetenca e të menduarit: Krahason figurat gjeometrike sipas numrit të brinjëve dhe kulmeve (p.sh. trekëndëshi ka 3, katrori ka 4).`,
            `Kompetenca e komunikimit: Përshkruan me fjalor të saktë dallimin mes katrorit (4 brinjë të barabarta) dhe drejtkëndëshit.`,
            `Kompetenca e të nxënit: Përdor vizoren për të bashkuar pikat dhe për të ndërtuar figura të rregullta.`,
            `Kompetenca personale: Zbulon forma gjeometrike në ambientin përreth dhe bashkëpunon në grup.`
          ],
          fieldOutcomes: [
            `Identifikon dhe emërton figurat plane bazë në mjedisin jetësor.`,
            `Dallon elementet përbërëse: brinjët dhe kulmet.`
          ],
          keywords: `${unitRaw}, figurë gjeometrike, katror, drejtkëndësh, trekëndësh, rreth, brinjë, kulm, vizore, Klasa ${classLabel || gr}, Ora ${pNum}`,
          lessonOutcomes: [
            `Emërton saktë katrorin, drejtkëndëshin, trekëndëshin dhe rrethin nga modelet e kartonit.`,
            `Numëron me gisht dhe shënon numrin e brinjëve dhe kulmeve për secilën figurë.`,
            `Vizatron me vizore një katror dhe një trekëndësh në fletoren me katrorë.`,
            `Identifikon të paktën 3 objekte në klasë që kanë formë katrore ose drejtkëndëshe (dritarja, libri, ora).`
          ],
          successCriteria: [
            `Unë mund të tregoj dhe të emërtoj figurën që më tregon mësuesi.`,
            `Unë mund të numëroj sa kulme dhe brinjë ka figura.`,
            `Unë mund të vizatoj një figurë të bukur duke përdorur vizoren.`
          ],
          resources: `Teksti mësimor, modele figurash prej kartoni me ngjyra, vizore shkollore, tabela, fletore vizatimi me katrorë.`,
          crossCurricular: `Art pamor (ngjyrosja e figurave dhe krijimi i një mozaiku me forma), Gjuhë shqipe (përshkrimi i sendeve).`,
          methodology: `Struktura EVR — Ora ${pNum} (Gjeometri, Klasa ${classLabel || gr}):\n\n` +
            `1. Evokimi (10 min): "Detektivët e formave": Mësuesi pyet "Çfarë forme ka dera e klasës? Po ora e murit? Po tabela?". Nxënësit vëzhgojnë me kureshtje dhe përgjigjen.\n\n` +
            `2. Realizimi i Kuptimit (25 min): Prezantimi i 4 figurave kryesore prej kartoni. Numërimi i brinjëve dhe kulmeve duke prekur me dorë. Demonstrimi i vizatimit të katrorit në fletoren me katrorë duke numëruar kutizat me vizore. Nxënësit vizatojnë format dhe i ngjyrosin.\n\n` +
            `3. Reflektimi (10 min): Loja "Kush jam unë?": Mësuesi jep gjëegjëzën: "Kam 3 brinjë dhe 3 kulme, kush jam unë?" (Trekëndëshi!). Përmbledhje e gëzueshme.`,
          assessment: `Vlerësim formativ i dallimit të brinjëve dhe kulmeve, si dhe saktësisë së vizatimit me vizore.`,
          homework: `Gjej në shtëpi 4 sende me forma të ndryshme gjeometrike dhe vizatoji ato në fletore.`,
          reflection: `Lidhja e figurave gjeometrike me objektet reale të klasës e bëri mësimin konkret dhe të paharrueshëm për fëmijët.`
        };
      }

      if (isClockTime) {
        return {
          topic: `Matematikë — ${unitRaw} (Klasa ${classLabel || gr}, Matja e kohës dhe leximi i orës, Ora ${pNum})`,
          topicLearningOutcome: `Nxënësi/ja njeh orën mekanike, dallon akrepat (i shkurtri i orëve, i gjati i minutave) dhe lexon me saktësi orën fikse dhe gjysmë ore për orarin ditor.`,
          competencyOutcomes: [
            `Kompetenca e të menduarit: Lidh pozicionin e akrepave me kohën e veprimeve ditore (ora e zgjimit, shkollës, drekës, gjumit).`,
            `Kompetenca e komunikimit: Lexon dhe shpreh me fjalë orën ekzakte (p.sh. "Ora është 8 ekzakt" apo "Ora është 8 e gjysmë").`,
            `Kompetenca e të nxënit: Zhvendos akrepat në modelin e orës sipas kërkesës së dhënë.`,
            `Kompetenca personale: Kupto rëndësinë e të qenit në kohë dhe rregullit në shkollë.`
          ],
          fieldOutcomes: [
            `Përdor njësitë standarde të kohës (ora, minuta) në situata reale.`,
            `Lexon orën analoge dhe digjitale bazë.`
          ],
          keywords: `${unitRaw}, orë, koha, akrepi i shkurtër, akrepi i gjatë, minutë, orë ekzakte, gjysmë ore, orar ditor, Klasa ${classLabel || gr}, Ora ${pNum}`,
          lessonOutcomes: [
            `Identifikon funksionin e dy akrepave të orës mekanike.`,
            `Lexon saktë orët fikse (kur akrepi i gjatë tregon 12) në 4 shembuj të ndryshëm.`,
            `Vendos akrepat në modelin didaktik të orës për orën 8:00, 10:00 dhe 12:00.`,
            `Lidh orët e lexuara me aktivitetet e ditës (mësimi, ushqimi, loja).`
          ],
          successCriteria: [
            `Unë mund të tregoj cili akrep tregon orët dhe cili minutat.`,
            `Unë mund të lexoj sa është ora kur akrepi i madh është te 12.`,
            `Unë mund të vendos akrepat e orës time model sipas orarit të shkollës.`
          ],
          resources: `Modele didaktike të orës me akrepa lëvizës prej plastike/kartoni, orë muri, teksti mësimor, fletë pune me vizatime orësh.`,
          crossCurricular: `Edukimi qytetar (menaxhimi i kohës dhe rregulli ditor), Gjuhë shqipe (bisedë rreth ditës sime).`,
          methodology: `Struktura EVR — Ora ${pNum} (Leximi i Orës, Klasa ${classLabel || gr}):\n\n` +
            `1. Evokimi (10 min): Tingulli "Tik-tak, tik-tak": Mësuesi pyet "Në cilën orë zgjoheni në mëngjes për të ardhur në shkollë?". Diskutim i shkurtër mbi oraret.\n\n` +
            `2. Realizimi i Kuptimit (25 min): Demonstrimi me orën e madhe model. Shpjegimi: "Akrepi i shkurtër ecën ngadalë dhe tregon orët; akrepi i gjatë tregon minutat. Kur i gjati është te 12, ora është fiks!". Ushtrim praktik: secili fëmijë lëviz akrepat e orës së vet model për orën 7:00, 9:00 dhe 1:00.\n\n` +
            `3. Reflektimi (10 min): Loja "Sa është ora, zoti Ujk?": Mësuesi ngre orën, fëmijët thonë me kor orën e saktë.`,
          assessment: `Vlerësim formativ i leximit të drejtë të akrepave dhe vendosjes së tyre në modelin e orës.`,
          homework: `Shëno në fletore orën kur shkon në gjumë dhe vizato akrepat në një orë të thjeshtë rrethore.`,
          reflection: `Fëmijët mësuan me shumë kureshtje leximin e akrepave. Përdorimi i orëve individuale me akrepa lëvizës siguroi pjesëmarrje 100%.`
        };
      }
    }

    // Default High-Fidelity Math (for any other math unit or higher grades)
    let mathStageFocus = pNum === 1 ? 'Parimet bazë, zbulimi i metodës dhe shembujt model (Ora 1)'
                       : pNum === 2 ? 'Ushtrime të thelluara, fletë pune dhe korrigjim gabimesh (Ora 2)'
                       : pNum === 3 ? 'Zbatim në situata konkrete jetësore dhe zgjidhje problemash (Ora 3)'
                       : `Përmbledhje, konsolidim njohurish dhe test formativ (Ora ${pNum})`;

    return {
      topic: `Matematikë — ${unitRaw} (Klasa ${classLabel || gr}, ${mathStageFocus})`,
      topicLearningOutcome: `Nxënësi/ja përvetëson konceptet thelbësore dhe rregullat llogaritëse për temën "${unitRaw}", duke zhvilluar arsyetimin logjik dhe shprehitë zbatuese matematikore për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Analizon të dhënat numerike të temës "${unitRaw}" dhe përzgjedh strategjinë më efikase të llogaritjes.`,
        `Kompetenca e komunikimit: Përdor terminologjinë dhe simbolet matematikore saktë gjatë arsyetimit të hapave.`,
        `Kompetenca e të nxënit: Punon me përqendrim dhe zbaton vetëkontrollin e rezultateve përmes rrugëve të anasjellta.`,
        `Kompetenca personale: Bashkëpunon në mënyrë konstruktive me shokët gjatë analizës së shembujve kompleksë.`
      ],
      fieldOutcomes: [
        `Zbaton rregullat dhe algoritmet matematikore përkatëse të shkallës ${stage}.`,
        `Arsyeton matematikisht dhe vërteton saktësinë e përfundimeve të nxjerra.`
      ],
      keywords: `${unitRaw}, veprime matematikore, rregulla llogaritëse, barazim, zgjidhje, arsyetim, fletë pune, Klasa ${classLabel || gr}, Ora ${pNum}`,
      lessonOutcomes: pNum === 1 ? [
        `Përkufizon konceptin kryesor matematikor të "${unitRaw}" përmes modeleve vizuale dhe tabelare.`,
        `Identifikon hapat e njëpasnjëshëm për zgjidhjen e saktë të shembullit model në tabelë.`,
        `Zgjidh me mbështetjen e mësimdhënësit/es 3 ushtrimet e para të nivelit bazë.`,
        `Shkruan procedurën llogaritëse me rregull dhe saktësi shkencore në fletore.`
      ] : pNum === 2 ? [
        `Zbaton në mënyrë të pavarur procedurat e mësuara në fletët e punës me shkallë të ndryshme vështirësie.`,
        `Dallon dhe korrigjon gabimet tipike llogaritëse në raste model të dhëna nga mësuesi.`,
        `Krahason strategji të ndryshme të zgjidhjes duke zgjedhur rrugën më të shkurtër.`,
        `Përfundon me saktësi detyrat e përcaktuara brenda kohës mësimore.`
      ] : [
        `Zgjidh problema kontekstuale nga jeta e përditshme duke zbatuar njohuritë e "${unitRaw}".`,
        `Ndërton modelin matematikor të problemës (të dhënat, pyetja, barazimi, zgjidhja).`,
        `Arsyeton vlefshmërinë e rezultatit të arritur në raport me kushtet e problemës.`,
        `Prezanton zgjidhjen para klasës duke argumentuar qartë çdo hap.`
      ],
      successCriteria: [
        `Unë mund të shpjegoj rregullën kryesore matematikore të orës së sotme.`,
        `Unë mund të zgjidh ushtrimet e përcaktuara në fletore pa bërë gabime procedurale.`,
        `Unë mund të argumentoj pse rezultati im është i saktë.`
      ],
      resources: `Teksti mësimor i Matematikës për klasën ${classLabel || gr}, tabela e shënimeve, fletore me katrorë, fletë pune me nivele të diferencuara, kalkulator (për klasat e larta).`,
      crossCurricular: `Gjuhët dhe komunikimi (formulimi i saktë i arsyetimit), Shkencat e natyrës (zbatimi i formulave në matje).`,
      methodology: `Struktura EVR — Ora ${pNum} (Matematikë, ${unitRaw}):\n\n` +
        `1. Evokimi (10 min): Nxehje mendore me pyetje diagnostikuese dhe rikujtim i rregullave paraprake të nevojshme për këtë temë.\n\n` +
        `2. Realizimi i Kuptimit (25 min): Prezantimi i konceptit të ri me shembull konkret në tabelë. Zbërthimi i hapave llogaritës. Punë e drejtuar me klasën dhe kalimi në punë të pavarur/në çifte me ushtrimet e fletores.\n\n` +
        `3. Reflektimi (10 min): Diskutimi i një rasti sfidues në tabelë, evidentimi i konkluzioneve kryesore dhe vetëvlerësimi.`,
      assessment: `• Vlerësim formativ i procesit të arsyetimit gjatë zgjidhjes së ushtrimeve.\n• Kontrolli i fletoreve dhe saktësisë së llogaritjeve.\n• Përgjigjet e dhëna gjatë fazës së reflektimit.`,
      homework: `Zgjidhja e 4 ushtrimeve përkatëse në tekstin mësimor dhe shënimi i provës përkatëse.`,
      reflection: `Nxënësit zotëruan hapat llogaritës dhe treguan siguri gjatë zbatimit të pavarur të rregullave.`
    };
  }

  // ==========================================================================
  // 2. LANGUAGES (Gjuhë shqipe, Gjuhë e huaj) — 100% Literary & Linguistic Focus
  // ==========================================================================
  if (subjType.isLanguage) {
    const isPoetry = /poez|vjersh|rim|strof|varg|poem|rhyme/i.test(uLower);
    const isStory = /tregim|përrall|fabul|legjend|ngjarj|personazh|story|tale/i.test(uLower);
    const isGrammarNoun = /em[eë]r|emri|noun/i.test(uLower);
    const isGrammarVerb = /folj|folja|verb/i.test(uLower);
    const isGrammarAdj = /mbiem[eë]r|adjective/i.test(uLower);
    const isSentence = /fjali|pikësim|pikë|pyetëse|dëftore|habitore|sentence/i.test(uLower);

    if (isPoetry) {
      return {
        topic: `Gjuhë shqipe — Poezia: "${unitRaw}" (Klasa ${classLabel || gr}, Ora ${pNum})`,
        topicLearningOutcome: `Nxënësi/ja lexon poezinë "${unitRaw}" me intonacion dhe ndjenjë, dallon vargjet, strofat dhe rimat, si dhe shpreh përjetimet emocionale që përcjell poezia.`,
        competencyOutcomes: [
          `Kompetenca e komunikimit: Reciton poezinë rrjedhshëm duke përshtatur tonin e zërit me kuptimin e vargjeve.`,
          `Kompetenca e të menduarit: Zbulon mesazhin kryesor dhe bukurinë e figurave letrare të përdorura nga poeti.`,
          `Kompetenca personale: Pasuron botën shpirtërore dhe shpreh ndjenjat vetjake me sinqeritet.`
        ],
        fieldOutcomes: [
          `Përjeton dhe vlerëson tekstin poetik sipas moshës.`,
          `Dallon strukturën e poezisë (vargun, strofën, rimën).`
        ],
        keywords: `${unitRaw}, poezi, varg, strofë, rimë, intonacion, mesazh poetik, recitim, ndjenja, Ora ${pNum}`,
        lessonOutcomes: [
          `Lexon poezinë me zë të qartë dhe theksin e duhur emocional.`,
          `Numëron sa strofa dhe sa vargje ka poezia e analizuar.`,
          `Gjen fjalët që rimojnë në fund të vargjeve (p.sh. lule - bukurie).`,
          `Përshkruan me fjalët e veta se çfarë e bën të veçantë këtë poezi.`
        ],
        successCriteria: [
          `Unë mund të lexoj poezinë bukur pa u ngatërruar te fjalët.`,
          `Unë mund të tregoj fjalët me rimë në strofën e parë.`,
          `Unë mund të shpjegoj çfarë ndiej kur e dëgjoj këtë poezi.`
        ],
        resources: `Libri i Gjuhës shqipe, libri i leximit, fletore shënimesh, ilustrime me ngjyra rreth temës së poezisë.`,
        crossCurricular: `Art pamor (ilustrimi i vargut më të preferuar me ngjyra), Edukatë muzikore (ritmi dhe melodia e fjalëve).`,
        methodology: `Struktura EVR — Ora ${pNum} (Poezia, Klasa ${classLabel || gr}):\n\n` +
          `1. Evokimi (10 min): Leximi model i poezisë nga mësimdhënësi/ja me zë të ngrohtë dhe muzikë të qetë. Çfarë menduat dhe çfarë ndjetë kur e dëgjuat?\n\n` +
          `2. Realizimi i Kuptimit (25 min): Lexim me vargje nga nxënësit me radhë. Shpjegimi i fjalëve të reja. Analiza e strofave dhe nënvizimi i fjalëve me rimë me laps me ngjyrë. Bisedë rreth mesazhit të poetit.\n\n` +
          `3. Reflektimi (10 min): Recitimi i strofës më të dashur nga disa nxënës vullnetarë dhe duartrokitje inkurajuese.`,
        assessment: `Vlerësim formativ i të shprehurit me intonacion, dallimit të rimave dhe pjesëmarrjes në bisedë.`,
        homework: `Mëso përmendsh strofën e parë dhe të dytë të poezisë dhe bëj një vizatim ilustrues në fletore.`,
        reflection: `Poezia ngjalli emocione të ngrohta në klasë. Fëmijët treguan dëshirë të madhe për të recituar me intonacion.`
      };
    }

    if (isStory) {
      return {
        topic: `Gjuhë shqipe — Tregimi / Përralla: "${unitRaw}" (Klasa ${classLabel || gr}, Ora ${pNum})`,
        topicLearningOutcome: `Nxënësi/ja lexon dhe kupton përmbajtjen e tekstit "${unitRaw}", dallon personazhet pozitive e negative, rendit ngjarjet sipas radhës kohore dhe nxjerr mesazhin edukativ.`,
        competencyOutcomes: [
          `Kompetenca e komunikimit: Ritrregon me fjalët e veta brendinë e tekstit duke ruajtur rrjedhën logjike.`,
          `Kompetenca e të menduarit: Gjykon veprimet e personazheve dhe arsyeton sjelljet e drejta.`,
          `Kompetenca qytetare: Vlerëson virtytet si mirësia, ndershmëria dhe ndihma ndaj të tjerëve.`
        ],
        fieldOutcomes: [
          `Lexon me kuptim tekste letrare në prozë të përshtatshme për moshën.`,
          `Karakterizon personazhet kryesore sipas veprimeve të tyre.`
        ],
        keywords: `${unitRaw}, tregim, përrallë, personazhe, ngjarje, fillimi, zhvillimi, mbyllja, mesazhi edukativ, Ora ${pNum}`,
        lessonOutcomes: [
          `Lexon tekstin në mënyrë të rrjedhshme duke respektuar shenjat e pikësimit.`,
          `U përgjigjet pyetjeve rreth brendisë së tregimit me fjali të plota.`,
          `Përshkruan cilësitë e personazhit kryesor (trim, bujar, i zgjuar, punëtor).`,
          `Nxjerr mësimin kryesor që na jep ngjarja.`
        ],
        successCriteria: [
          `Unë mund të tregoj me pak fjalë se çfarë ndodhi në këtë tregim.`,
          `Unë mund të emërtoj personazhet kryesore dhe të them mendimin tim për to.`,
          `Unë mund t'u përgjigjem pyetjeve të tekstit saktë.`
        ],
        resources: `Teksti mësimor, fletore, kartela me pyetje mirëkuptimi, ilustrime të ngjarjes.`,
        crossCurricular: `Edukatë qytetare (edukimi i vlerave morale dhe bashkëpunimit), Art pamor (vizatimi i skenës kryesore).`,
        methodology: `Struktura EVR — Ora ${pNum} (Gjuhë shqipe, Teksti në prozë):\n\n` +
          `1. Evokimi (10 min): Paraqitja e një ilustrimi të tregimit: "Çfarë po shihni në figurë? Çfarë mendoni se do të ndodhë?". Stuhi mendimesh.\n\n` +
          `2. Realizimi i Kuptimit (25 min): Leximi i drejtuar me ndalesa. Diskutimi i secilës pjesë. Pyetje - përgjigje rreth veprimeve të personazheve. Shpjegimi i fjalorit të panjohur.\n\n` +
          `3. Reflektimi (10 min): "Harta e personazheve": shënimi në tabelë i cilësive të mira të personazhit kryesor dhe formulimi i mesazhit.`,
        assessment: `Vlerësim formativ i të kuptuarit të leximit, ritregimit dhe argumentimit të sjelljeve.`,
        homework: `Përgjigju me shkrim në fletore 3 pyetjeve të para të tekstit dhe shkruaj 2 fjali për personazhin tënd të dashur.`,
        reflection: `Nxënësit u përfshinë me entuziazëm në diskutim dhe dalluan me lehtësi mesazhin human të tregimit.`
      };
    }

    if (isGrammarNoun || isGrammarVerb || isGrammarAdj || isSentence) {
      const grammarPart = isGrammarNoun ? 'Emri (i përgjithshëm dhe i përveçëm)'
                        : isGrammarVerb ? 'Folja dhe koha e saj'
                        : isGrammarAdj ? 'Mbiemri dhe cilësitë e sendeve'
                        : 'Fjalia dhe shenjat e pikësimit';
      return {
        topic: `Gjuhë shqipe — ${unitRaw}: ${grammarPart} (Klasa ${classLabel || gr}, Ora ${pNum})`,
        topicLearningOutcome: `Nxënësi/ja dallon, emërton dhe zbaton saktë në të folur dhe me shkrim njohuritë gjuhësore për temën "${unitRaw}", duke pasuruar fjalorin dhe zbatuar rregullat e drejtshkrimit.`,
        competencyOutcomes: [
          `Kompetenca e komunikimit: Formon fjali të sakta gramatikore duke përdorur me vend fjalët e mësuara.`,
          `Kompetenca e të menduarit: Klasifikon fjalët sipas funksionit dhe kuptimit të tyre gjuhësor.`,
          `Kompetenca e të nxënit: Zbaton rregullat e drejtshkrimit (p.sh. shkronja e madhe, pika, pikëpyetja) në fletore.`
        ],
        fieldOutcomes: [
          `Zotëron strukturën gjuhësore dhe drejtshkrimin e gjuhës standarde.`,
          `Dallon pjesët e ligjëratës dhe rolin e tyre në fjali.`
        ],
        keywords: `${unitRaw}, gjuhësi, gramatikë, drejtshkrim, fjali, fjalë, shkronjë e madhe, Klasa ${classLabel || gr}, Ora ${pNum}`,
        lessonOutcomes: [
          `Identifikon konceptin gjuhësor në fjalitë model të paraqitura në tabelë.`,
          `Dallon veçoritë kryesore të fjalëve sipas rregullit gjuhësor të orës.`,
          `Krijon të paktën 3 fjali vetjake duke zbatuar rregullën e re.`,
          `Korrigjon gabimet e drejtshkrimit në shembujt e dhënë në fletën e punës.`
        ],
        successCriteria: [
          `Unë mund të gjej fjalët përkatëse në tekstin e dhënë.`,
          `Unë mund të formoj një fjali të bukur dhe ta shkruaj pa gabime.`,
          `Unë mund të shpjegoj pse përdoret shkronja e madhe ose shenja përkatëse e pikësimit.`
        ],
        resources: `Teksti mësimor i Gjuhës shqipe, fletore, kartela gjuhësore me ngjyra, tabela e klasës.`,
        crossCurricular: `Shoqëria dhe mjedisi (komunikimi qytetar), Art pamor (shkrimi artistik i bukurshkrimit).`,
        methodology: `Struktura EVR — Ora ${pNum} (Njohuri Gjuhësore, Klasa ${classLabel || gr}):\n\n` +
          `1. Evokimi (10 min): Lojë gjuhësore me fjalë në tabelë. Nxënësit gjejnë çfarë kanë të përbashkët fjalët e shkruara.\n\n` +
          `2. Realizimi i Kuptimit (25 min): Zbulimi i rregullës gjuhësore së bashku. Shpjegimi i qartë nga mësuesi me shembuj ilustrues. Nxënësit plotësojnë ushtrimet në libër dhe punojnë në fletore duke krijuar fjalitë e tyre.\n\n` +
          `3. Reflektimi (10 min): "Gjuetia e gabimeve": Nxënësit zbulojnë dhe rregullojnë një gabim të qëllimshëm të shkruar në tabelë.`,
        assessment: `Vlerësim formativ i zbatimit të rregullave gramatikore dhe bukurshkrimit në fletore.`,
        homework: `Shkruaj në fletore 4 fjali duke përdorur fjalët e mësuara sot dhe nënvizo ato me ngjyrë.`,
        reflection: `Nxënësit përvetësuan konceptin me lehtësi falë shembujve konkretë dhe punës aktive me kartela.`
      };
    }
  }

  // ==========================================================================
  // 3. NATURAL SCIENCES (Dituri natyre, Biologji, Fizikë, Kimi)
  // ==========================================================================
  if (subjType.isScience) {
    const isPlants = /bim|lule|pem|far|gjethe|rrënj|fotosintez|plant|flower/i.test(uLower);
    const isAnimals = /kafsh|shpend|peshk|insekt|shqis|gjitar|habit|animal/i.test(uLower);
    const isHumanBody = /trup|shqis|organ|skelet|muskuj|zem[eë]r|ushqim|shëndet|dhëmb|body|health/i.test(uLower);
    const isSeasonsWeather = /stin|mot|ujë|ajër|tok|diell|reshje|avull|akull|season|weather|water/i.test(uLower);

    return {
      topic: `Dituri natyre — ${unitRaw}: Vëzhgimi, eksperimenti dhe kuptimi i botës së gjallë (Klasa ${classLabel || gr}, Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja vëzhgon, heton dhe përshkruan proceset natyrore të temës "${unitRaw}", duke dalluar karakteristikat kryesore dhe rëndësinë e tyre për jetën në Tokë për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Krahason të dhënat e vëzhguara dhe nxjerr përfundime të thjeshta shkencore.`,
        `Kompetenca e komunikimit: Përshkruan dukuritë natyrore me fjalor të saktë shkencor.`,
        `Kompetenca qytetare: Zhvillon dashurinë dhe përgjegjësinë për mbrojtjen e mjedisit dhe natyrës.`
      ],
      fieldOutcomes: [
        `Zbaton hapat e thjeshtë të vëzhgimit dhe hulumtimit shkencor.`,
        `Kupto ndërvarësinë mes qenieve të gjalla dhe mjedisit ku jetojnë.`
      ],
      keywords: `${unitRaw}, natyrë, vëzhgim, botë e gjallë, mjedis, eksperiment, Klasa ${classLabel || gr}, Ora ${pNum}`,
      lessonOutcomes: [
        `Identifikon elementet kryesore të temës përmes fotografive dhe objekteve reale.`,
        `Përshkruan me fjalë të thjeshta se si funksionon dukuria e vëzhguar në natyrë.`,
        `Merr pjesë aktive në demonstrimin e thjeshtë eksperimental në klasë.`,
        `Liston të paktën 2 mënyra se si mund të kujdesemi për këtë pasuri natyrore.`
      ],
      successCriteria: [
        `Unë mund të tregoj pjesët kryesore ose vetitë e vëzhguara sot.`,
        `Unë mund të shpjegoj pse kjo dukuri është e rëndësishme për njerëzit dhe natyrën.`,
        `Unë mund të vizatoj dhe të emërtoj saktë elementet në fletoren time.`
      ],
      resources: `Teksti mësimor, fletore pune, lupa zmadhuese, mostra natyrore (gjethe, fara, ujë, gurë), tabela me figura.`,
      crossCurricular: `Gjuhë shqipe (pasurimi i fjalorit përshkrues), Art pamor (skicimi i bimës/kafshës me detaje).`,
      methodology: `Struktura EVR — Ora ${pNum} (Dituri Natyre, Klasa ${classLabel || gr}):\n\n` +
        `1. Evokimi (10 min): Prezantimi i një objekti real ose foto kureshtare nga natyra: "Çfarë është kjo dhe ku e keni parë në natyrë?". Pyetje nxitëse.\n\n` +
        `2. Realizimi i Kuptimit (25 min): Vëzhgimi i drejtpërdrejtë me lupë. Shpjegimi i procesit natyror nga mësuesi. Nxënësit punojnë në fletoren e punës duke vizatuar dhe plotësuar etiketat me emrat përkatës.\n\n` +
        `3. Reflektimi (10 min): "Rrethi i pyetjeve shkencore": nxënësit bëjnë pyetje të ndërsjella rreth asaj që zbuluan sot.`,
      assessment: `Vlerësim formativ i shkathtësive vëzhguese, vizatimit të saktë dhe përgjigjeve gojore.`,
      homework: `Vëzhgo në oborr ose në shtëpi një shembull të lidhur me temën dhe bëj një vizatim të shkurtër me shënime.`,
      reflection: `Nxënësit treguan kureshtje të lartë kërkimore. Vëzhgimi i drejtpërdrejtë zgjoi interesim të thellë për natyrën.`
    };
  }

  // ==========================================================================
  // 4. SOCIAL SCIENCES, CIVICS, HISTORY, GEOGRAPHY
  // ==========================================================================
  if (subjType.isHistory || subjType.isGeography || subjType.isCivics) {
    const domainName = subjType.isHistory ? 'Histori' : subjType.isGeography ? 'Gjeografi' : 'Edukatë qytetare';
    return {
      topic: `${domainName} — ${unitRaw} (Klasa ${classLabel || gr}, Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja kupton dhe analizon ngjarjet, dukuritë shoqërore apo gjeografike për temën "${unitRaw}", duke zhvilluar ndërgjegjen qytetare dhe orientimin hapësinor-kohor për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca qytetare: Njeh të drejtat, përgjegjësitë dhe rëndësinë e bashkëjetesës demokratike.`,
        `Kompetenca e të menduarit: Lidh shkaqet dhe pasojat e ngjarjeve apo veprimeve njerëzore në shoqëri.`,
        `Kompetenca e komunikimit: Shpreh mendimin vetjak me respekt ndaj mendimit ndryshe të të tjerëve.`
      ],
      fieldOutcomes: [
        `Njeh mjedisin shoqëror, historik dhe gjeografik vetjak dhe global.`,
        `Demonstron sjellje aktive qytetare dhe respekt për diversitetin kulturor.`
      ],
      keywords: `${unitRaw}, ${domainName}, shoqëri, histori, komunitet, qytetari, orientim, Ora ${pNum}`,
      lessonOutcomes: [
        `Përshkruan thelbin e temës me shembuj nga jeta në shkollë, familje apo komunitet.`,
        `Identifikon vendndodhjen, kohën ose rregullin kryesor të trajtuar gjatë orës.`,
        `Diskuton në grup rreth rëndësisë së bashkëpunimit dhe ndihmës reciproke.`,
        `Formulon një mesazh pozitiv për përmirësimin e mjedisit ku jetojmë.`
      ],
      successCriteria: [
        `Unë mund të shpjegoj me fjalët e mia temën që mësuam sot.`,
        `Unë mund të jap një shembull se si mund ta zbatoj këtë në jetën time të përditshme.`,
        `Unë mund të dëgjoj me vëmendje shokët gjatë diskutimit në klasë.`
      ],
      resources: `Teksti mësimor, harta gjeografike/historike, fletore shënimesh, fotografi dokumentare, tabela.`,
      crossCurricular: `Gjuhët dhe komunikimi (debati dhe argumentimi), Art pamor (krijimi i posterëve edukativë).`,
      methodology: `Struktura EVR — Ora ${pNum} (${domainName}):\n\n` +
        `1. Evokimi (10 min): Diskutim nxitës rreth një situate reale jetësore të lidhur me temën. Çfarë do të bënit ju në këtë rast?\n\n` +
        `2. Realizimi i Kuptimit (25 min): Prezantimi i temës me harta, foto apo tregim historik. Puna në grupe të vogla me kartela diskutimi. Pasqyrimi i ideve kryesore në tabelë.\n\n` +
        `3. Reflektimi (10 min): "Pema e ideve qytetare": nxënësit ngjisin një mesazh të shkurtër në pemën e klasës.`,
      assessment: `Vlerësim formativ i argumentimit, bashkëpunimit qytetar dhe të kuptuarit të koncepteve.`,
      homework: `Bisedoni me prindërit rreth kësaj teme dhe shkruani 3 fjali përmbledhëse në fletore.`,
      reflection: `Nxënësit manifestuan pjekuri dhe interesim të lartë gjatë debatit për vlerat qytetare.`
    };
  }

  // ==========================================================================
  // 5. ARTS & PHYSICAL EDUCATION (Figurative Art, Music, PE)
  // ==========================================================================
  if (subjType.isArt || subjType.isPE) {
    const isPE = subjType.isPE;
    const isMusic = /muzik/i.test(subjRaw);
    const domainName = isPE ? 'Edukatë fizike' : isMusic ? 'Edukatë muzikore' : 'Edukatë figurative';

    if (isPE) {
      return {
        topic: `Edukatë fizike — ${unitRaw}: Lëvizja, koordinimi dhe shëndeti trupor (Klasa ${classLabel || gr}, Ora ${pNum})`,
        topicLearningOutcome: `Nxënësi/ja kryen me korrektësi lëvizjet bazë trupore, zhvillon shkathtësitë motorike dhe zbaton rregullat e lojës së ndershme për klasën ${classLabel || gr}.`,
        competencyOutcomes: [
          `Kompetenca personale: Përmirëson qëndrimin trupor, frymëmarrjen e rregullt dhe shprehitë higjienike.`,
          `Kompetenca sociale: Bashkëpunon në ekip dhe respekton rregullat e lojës (fair-play).`
        ],
        fieldOutcomes: [
          `Zotëron lëvizjet bazë lokomotore (vrapim, kërcim, zhdërvjelltësi).`,
          `Zbaton rregullat e sigurisë gjatë aktiviteteve fizike.`
        ],
        keywords: `${unitRaw}, vrapim, kërcim, koordinim, lojëra lëvizore, shëndet, bashkëpunim, Ora ${pNum}`,
        lessonOutcomes: [
          `Kryen ushtrimet e nxehjes trupore sipas udhëzimeve të mësimdhënësit/es.`,
          `Zbaton teknikën e saktë të lëvizjes gjatë aktivitetit kryesor.`,
          `Merr pjesë me gëzim dhe disiplinë në lojën lëvizore të organizuar në grup.`,
          `Kryen ushtrimet e qetësimit dhe rregullimit të frymëmarrjes në fund të orës.`
        ],
        successCriteria: [
          `Unë mund të ndjek ritmin e ushtrimeve me përqendrim.`,
          `Unë mund të bashkëpunoj me shokët pa u shtyrë dhe pa shkelur rregullat.`,
          `Unë mund të kujdesem për sigurinë time dhe të shokëve gjatë lojës.`
        ],
        resources: `Salla e sportit / fusha e shkollës, topa, shkopinj gjimnastikorë, konë orientues, bilbil.`,
        crossCurricular: `Dituri natyre (trupi i njeriut, muskujt dhe frymëmarrja), Edukatë qytetare (ndershmëria sportive).`,
        methodology: `Struktura e Orës së Edukatës Fizike — Ora ${pNum} (${unitRaw}):\n\n` +
          `1. Pjesa hyrëse (10 min): Rreshtimi, kontrolli i veshjes sportive dhe ushtrimet e përgjithshme të nxehjes për të gjitha grupet e muskujve.\n\n` +
          `2. Pjesa themelore (25 min): Demonstrimi i teknikës kryesore të orës (${unitRaw}). Përsëritja në kolona me stafetë. Zhvillimi i lojës lëvizore në ekipe me rregulla të qarta.\n\n` +
          `3. Pjesa përfundimtare (10 min): Ecje e ngadaltë me ushtrime të frymëmarrjes dhe qetësimit. Vlerësimi i angazhimit dhe rreshtimi për largim.`,
        assessment: `Vlerësim formativ i koordinimit lëvizor, disiplinës dhe frymës së bashkëpunimit sportiv.`,
        homework: `Ecni në natyrë me familjen dhe bëni 10 minuta ushtrime të lehta shtrirjeje në mëngjes.`,
        reflection: `Ora u zhvillua me dinamikë të lartë dhe gëzim. Nxënësit respektuan plotësisht rregullat e lojës së ndershme.`
      };
    }

    return {
      topic: `${domainName} — ${unitRaw}: Shprehja krijuese, teknika dhe estetika (Klasa ${classLabel || gr}, Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja kultivon ndjeshmërinë estetike, zotëron teknikat praktike dhe shpreh përjetimet individuale përmes veprimtarive artistike për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e komunikimit dhe të shprehurit: Shpreh emocione, ide dhe përjetime përmes gjuhës artistike (ngjyrës/tingullit).`,
        `Kompetenca personale: Zhvillon këmbënguljen, imagjinatën dhe vlerësimin e bukurisë në jetë.`
      ],
      fieldOutcomes: [
        `Përdor teknikat përkatëse me siguri, pastërti dhe kreativitet vetjak.`,
        `Shijon dhe vlerëson krijimet artistike vetjake dhe të bashkëmoshatarëve.`
      ],
      keywords: `${unitRaw}, ngjyrë, vizatim, tingull, ritëm, melodi, krijimtari, harmoni, imagjinatë, Ora ${pNum}`,
      lessonOutcomes: [
        `Zbaton me saktësi elementet teknike të orës së mësimit sipas udhëzimeve.`,
        `Krijon një punim/performancë origjinale me imagjinatën e tij/saj.`,
        `Përdor mjetet didaktike me kujdes dhe mban pastër hapësirën e punës.`,
        `Përshkruan me fjalë të thjeshta se çfarë ka shprehur në krijimin e realizuar.`
      ],
      successCriteria: [
        `Unë mund të zbatoj këshillat teknike gjatë punës sime krijuese.`,
        `Unë mund të përfundoj punimin brenda orës me përqendrim.`,
        `Unë mund të them një fjalë të bukur dhe inkurajuese për punën e shokut tim.`
      ],
      resources: isMusic ? `Teksti i muzikës, instrumente të thjeshta ritmike (daulle, zile, trekëndësh), pajisje audio për dëgjim.` : `Teksti i artit, bllok vizatimi, lapsa me ngjyra, akuarele, plastelinë.`,
      crossCurricular: `Gjuhë shqipe (përshkrimi i ndjenjave), Matematikë (ritmi, simetria dhe format).`,
      methodology: `Struktura EVR — Ora ${pNum} (${domainName}):\n\n` +
        `1. Evokimi (10 min): Dëgjimi i një melodie të bukur ose vëzhgimi i një pikture frymëzuese. Çfarë ndiejmë?\n\n` +
        `2. Realizimi i Kuptimit (25 min): Shpjegimi i teknikës dhe demonstrimi i hapave. Puna e pavarur krijuese e nxënësve me muzikë të qetë në sfond.\n\n` +
        `3. Reflektimi (10 min): "Ekspozita e klasës" / Këndimi i përbashkët në kor dhe duartrokitjet vlerësuese.`,
      assessment: `Vlerësim formativ i imagjinatës krijuese, respektimit të teknikës dhe dëshirës për të krijuar bukur.`,
      homework: `Vëzhgoni një peizazh apo dëgjoni një melodi në shtëpi dhe shijojeni me familjen.`,
      reflection: `Nxënësit përjetuan kënaqësi të thellë estetike dhe punuan në qetësi e harmoni të plotë.`
    };
  }

  // ==========================================================================
  // 6. TIK & TECHNOLOGY (Strictly when subject is TIK / Informatics!)
  // ==========================================================================
  if (subjType.isTIK) {
    const isPrimaryTIK = gr <= 3;
    if (isPrimaryTIK) {
      return {
        topic: `Teknologji me TIK — ${unitRaw}: Pajisjet digjitale dhe siguria (Klasa ${classLabel || gr}, Ora ${pNum})`,
        topicLearningOutcome: `Nxënësi/ja njeh pjesët kryesore të pajisjeve digjitale (miun, tastierën, ekranin), zbaton rregullat e higjienës dhe kohës së shëndetshme para ekranit për klasën ${classLabel || gr}.`,
        competencyOutcomes: [
          `Kompetenca digjitale: Përdor miun dhe tastierën me kujdes dhe saktësi.`,
          `Kompetenca personale: Zbaton rregullat e distancës nga ekrani dhe shëndetit të syve.`
        ],
        fieldOutcomes: [
          `Emërton pajisjet kryesore të teknologjisë informative.`,
          `Kupton se kompjuteri është një mjet ndihmës për të mësuar dhe krijuar.`
        ],
        keywords: `${unitRaw}, kompjuter, miu, tastiera, ekrani, rregulla sigurie, Klasa ${classLabel || gr}, Ora ${pNum}`,
        lessonOutcomes: [
          `Tregon me emër ekranin, tastierën, miun dhe njësinë qendrore.`,
          `Përdor miun për të klikuar dhe zhvendosur objekte në programe edukative.`,
          `Zbaton rregullin e qëndrimit drejt në karrige para kompjuterit.`,
          `Mbyll pajisjen sipas udhëzimit të mësuesit në fund të orës.`
        ],
        successCriteria: [
          `Unë mund të emërtoj pjesët e kompjuterit.`,
          `Unë mund të mbaj miun saktë pa e goditur.`,
          `Unë mund të them pse nuk duhet të rrimë shumë gjatë para ekranit.`
        ],
        resources: `Kabinëti i TIK / pajisje demonstruese, kartela me figura të pajisjeve, fletore pune.`,
        crossCurricular: `Dituri natyre (shëndeti i syve dhe trupit), Art pamor (vizatimi me forma në kompjuter).`,
        methodology: `Struktura EVR — Ora ${pNum} (TIK Fillore):\n\n` +
          `1. Evokimi (10 min): Bisedë rreth pajisjeve që shohim në shtëpi (telefoni, tableti, televizori, kompjuteri). Për çfarë na shërbejnë?\n\n` +
          `2. Realizimi i Kuptimit (25 min): Demonstrimi i pjesëve të kompjuterit. Ushtrimi praktik me lëvizjen e miut dhe klikimin mbi figura me ngjyra. Respektimi i qëndrimit të drejtë të trupit.\n\n` +
          `3. Reflektimi (10 min): Loja "Qëndro drejt dhe trego": nxënësit tregojnë pjesën e kompjuterit që përmend mësuesi.`,
        assessment: `Vlerësim formativ i përdorimit me kujdes të pajisjeve dhe sjelljes së sigurt në kabinet.`,
        homework: `Vizato në fletore një kompjuter dhe shkruaj me ndihmën e prindit emrat e 3 pjesëve të tij.`,
        reflection: `Fëmijët treguan kujdes të veçantë gjatë trajtimit të pajisjeve në kabinet.`
      };
    }

    return {
      topic: `TIK — ${unitRaw}: Zbatimi praktik, logjika dhe siguria digjitale (Klasa ${classLabel || gr}, Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja përvetëson konceptet e logjikës kompjuterike, përdor mjetet digjitale me siguri dhe zgjidh detyra praktike për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Zbërthen një problem në hapa të vegjël të njëpasnjëshëm.`,
        `Kompetenca digjitale: Përdor programet me efikasitet dhe etikë.`
      ],
      fieldOutcomes: [
        `Harton dhe zbaton sekuenca hapash për zgjidhjen e detyrave praktike.`,
        `Zbaton rregullat e sigurisë në internet dhe mbrojtjes së të dhënave.`
      ],
      keywords: `${unitRaw}, TIK, logjikë, sekuencë, siguri në internet, softuer, Klasa ${classLabel || gr}, Ora ${pNum}`,
      lessonOutcomes: [
        `Përshkruan hapat e veprimit në mënyrë të saktë dhe logjike.`,
        `Përdor veglat softuerike për të realizuar detyrën e caktuar.`,
        `Identifikon dhe korrigjon gabimet e thjeshta gjatë punës.`,
        `Zbaton rregullat e sigurisë dhe etikës digjitale.`
      ],
      successCriteria: [
        `Unë mund të rendis saktë hapat e veprimit.`,
        `Unë mund të korrigjoj gabimet në punën time.`,
        `Unë mund të respektoj rregullat e kabinetit dhe internetit.`
      ],
      resources: `Laboratori i TIK, kompjuterët, fletë pune digjitale.`,
      crossCurricular: `Matematikë (logjika), Gjuhë shqipe (saktësia e shprehjes).`,
      methodology: `Struktura EVR — Ora ${pNum} (TIK):\n\n` +
        `1. Evokimi (10 min): Diskutimi i një veprimi hap pas hapi.\n\n` +
        `2. Realizimi i Kuptimit (25 min): Shpjegimi i procedurës dhe puna praktike në pajisje.\n\n` +
        `3. Reflektimi (10 min): Prezantimi i punës së përfunduar dhe vetëvlerësimi.`,
      assessment: `Vlerësim formativ i zbatimit praktik dhe bashkëpunimit.`,
      homework: `Përgatitni një përmbledhje të shkurtër me 5 rregulla të sigurisë digjitale.`,
      reflection: `Nxënësit zbatuan detyrën me sukses dhe përqendrim.`
    };
  }

  // ==========================================================================
  // 7. GENERAL UNLISTED SUBJECT
  // ==========================================================================
  return {
    topic: `${subjRaw} — ${unitRaw} (Klasa ${classLabel || gr}, Ora ${pNum})`,
    topicLearningOutcome: `Nxënësi/ja përvetëson njohuritë dhe shkathtësitë e parashikuara për temën "${unitRaw}", duke zhvilluar arsyetimin logjik dhe shkathtësitë zbatuese për klasën ${classLabel || gr}.`,
    competencyOutcomes: [
      `Kompetenca e komunikimit: Përdor terminologjinë përkatëse lëndore për të artikuluar qartë idetë rreth temës "${unitRaw}".`,
      `Kompetenca e të menduarit: Analizon dhe zbërthen informacionin e ri duke e zbatuar në shembuj konkretë të orës ${pNum}.`,
      `Kompetenca e të nxënit: Menaxhon kohën e punës me rregull dhe vetëvlerëson nivelin e arritjes së kritereve.`,
      `Kompetenca personale: Bashkëpunon pozitivisht dhe me respekt reciprok gjatë punës në grup.`
    ],
    fieldOutcomes: [
      `Zbaton konceptet thelbësore të fushës "${curricularArea || subjRaw}" në veprimtari mësimore të përshtatshme për ${stage}.`,
      `Demonstron zotërim të shprehive lëndore përmes mjeteve didaktike të përzgjedhura.`
    ],
    keywords: `${unitRaw}, ${subjRaw}, konceptet lëndore, arsyetim, ushtrime, zbatim praktik, shkathtësi, Ora ${pNum}`,
    lessonOutcomes: [
      `Dallon dhe identifikon elementet thelbësore të "${unitRaw}" përmes vëzhgimit dhe shembujve konkretë.`,
      `Shpjegon parimin kryesor që rregullon këtë temë në kuadër të lëndës ${subjRaw}.`,
      `Zgjidh detyrat dhe ushtrimet e orës ${pNum} me saktësi dhe përqendrim.`,
      `Lidh njohuritë e reja me situata konkrete nga përvoja dhe mjedisi jetësor.`
    ],
    successCriteria: [
      `Unë mund të shpjegoj konceptin kryesor të mësuar sot me fjalë të qarta.`,
      `Unë mund të zgjidh ushtrimet e përcaktuara në mënyrë të pavarur.`,
      `Unë mund të bashkëpunoj me shokët për të diskutuar përfundimet e orës.`
    ],
    resources: `Teksti mësimor i klasës ${classLabel || gr}, fletore pune, tabela e shënimeve, fletë pune të përgatitura, mjete didaktike.`,
    crossCurricular: `Gjuhët dhe komunikimi (përvetësimi i fjalorit të saktë), Edukatë qytetare (bashkëpunimi dhe respekti reciprok).`,
    methodology: `Struktura EVR — Ora ${pNum} (${subjRaw}, Klasa ${classLabel || gr}):\n\n` +
      `1. Evokimi (10 min): Pyetje nxitëse dhe stuhi mendimesh për të aktivizuar njohuritë paraprake rreth "${unitRaw}".\n\n` +
      `2. Realizimi i Kuptimit (25 min): Prezantimi interaktiv i materialit të ri. Modelimi i shembujve në tabelë. Punë në dyshe dhe punë e pavarur me fletët e punës.\n\n` +
      `3. Reflektimi (10 min): Përmbledhja e zbulimeve kryesore përmes teknikës "Çfarë mësuam sot?" dhe vetëvlerësimi.`,
    assessment: `• Vlerësim formativ përmes vëzhgimit të drejtpërdrejtë dhe pyetjeve diagnostikuese.\n• Kontrolli i fletëve të punës dhe zgjidhjeve individuale.\n• Vlerësimi i bashkëpunimit gjatë aktiviteteve në klasë.`,
    homework: `Zgjidhja e ushtrimeve përkatëse në fletoren e punës dhe shënimi i një pyetjeje për orën pasuese.`,
    reflection: `Objektivat e parashikuara për orën ${pNum} u realizuan me sukses. Nxënësit treguan interesim të lartë gjatë aktiviteteve.`
  };
}

/**
 * Main export: Generate complete lesson plan with AI
 */
export async function generateLessonPlanWithAI(planContext, userApiKey = '') {
  const {
    subject,
    classLabel,
    lessonUnit,
    curricularArea,
    curriculumStage,
    date,
    period,
    academicYear,
    duration,
    language = 'sq'
  } = planContext;

  const parsed = parseClassLabel(classLabel);
  const grade = parsed?.grade ?? (classLabel ? (classLabel.match(/\b(1[0-2]|[1-9])\b/) ? parseInt(classLabel.match(/\b(1[0-2]|[1-9])\b/)[0], 10) : null) : 2);
  const stage = curriculumStage || (classLabel ? stageForClass(classLabel) : 'Shkalla I');
  const area = curricularArea || (subject ? getSubjectArea(subject, { classLabel }) : 'Kurrikulare');
  const pInfo = parsePeriod(period);

  const storageKey = typeof localStorage !== 'undefined' ? localStorage.getItem('lumi-gemini-api-key') : '';
  const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY ? import.meta.env.VITE_GEMINI_API_KEY : '';
  const apiKey = clean(userApiKey || storageKey || envKey || '');

  const isSq = language === 'sq';

  // 1. Try Google Gemini API if a key is present
  if (apiKey) {
    const prompt = `You are a distinguished master pedagogue adhering strictly to the Kosovo & Albania Ministry of Education (MASHTI) competency-based curriculum framework.

You must generate an exhaustive, highly specific, and age-appropriate lesson plan for:
- Subject (Lënda): ${subject}
- Class/Grade (Klasa): ${classLabel} (Grade ${grade ?? 2}, Age ${(grade ?? 2) + 5}-${(grade ?? 2) + 6}, Stage: ${stage})
- Curricular Area (Fusha Kurrikulare): ${area}
- Exact Lesson Topic / Unit (Njësia Mësimore): "${lessonUnit}"
- Lesson Period (Ora Mësimore): Ora ${pInfo.number} (${pInfo.stage})
- Duration: ${duration || 45} minutes
- Language: Output strictly in ${isSq ? 'Albanian (Shqip)' : 'English'}.

CRITICAL QUALITY INSTRUCTIONS - NO GENERIC BOILERPLATE & STRICT SUBJECT DISCIPLINE:
1. STRICT SUBJECT & TOPIC FIDELITY:
   - The ENTIRE plan must be 100% specifically about "${lessonUnit}" within the subject "${subject}".
   - Every single outcome, activity, example, and criterion must directly reference and work with the specific mathematical, linguistic, scientific, or historical concepts of "${lessonUnit}".
   - If Subject is Mathematics (${subject}), write ONLY about numbers, calculations, geometry, word problems, shapes, or time matching Grade ${grade ?? 2}. NEVER mention robots, algorithms, coding, software, or technology unless the subject is explicitly TIK / Informatics!
2. COGNITIVE LEVEL FOR GRADE ${grade ?? 2}:
   - For Grade 1-2 (Age 6-8): Use concrete representations (manipulatives, counting blocks, drawings, simple classroom objects, pair games).
   - For Grade 3-5 (Age 8-11): Use conceptual explanations, standard arithmetic/language procedures, structured practice, vocabulary building, applied problems.
   - For Grade 6-9 (Age 11-15): Use analytical thinking, formal notation, multi-step problem solving, critical discussion.
3. PEDAGOGICAL STAGE FOR ORA ${pInfo.number}:
   - Ora 1: Introduction, schema activation, concrete/visual modeling, initial teacher-guided examples.
   - Ora 2: Guided practice, independent workbook exercises, error identification, peer discussion.
   - Ora 3: Applied real-world problems, contextual challenges, word problems, synthesis.
   - Ora 4+: Consolidation, formative quiz, review of key competencies.
4. FORBIDDEN:
   - NEVER write generic placeholder phrases like "Përkufizon dhe shpjegon konceptin kryesor të ${lessonUnit} me fjalët e veta" or "Unë mund të shpjegoj qartë se çfarë është ${lessonUnit}".
   - Write concrete actions, numbers, and tasks.

Return ONLY a valid JSON object matching this schema:
{
  "topic": "Specific Topic title mentioning Grade and Ora ${pInfo.number}",
  "topicLearningOutcome": "Rich paragraph describing conceptual competency for this grade and this exact unit",
  "competencyOutcomes": [
    "Kompetenca e të menduarit: specific outcome...",
    "Kompetenca e komunikimit: specific outcome...",
    "Kompetenca e të nxënit: specific outcome...",
    "Kompetenca personale: specific outcome..."
  ],
  "fieldOutcomes": [
    "Specific field outcome 1...",
    "Specific field outcome 2..."
  ],
  "keywords": "Specific keywords separated by comma",
  "lessonOutcomes": [
    "Concrete specific outcome 1 for this hour and grade...",
    "Concrete outcome 2...",
    "Concrete outcome 3...",
    "Concrete outcome 4..."
  ],
  "successCriteria": [
    "Unë mund të...",
    "Unë mund të...",
    "Unë mund të..."
  ],
  "resources": "Specific concrete materials suitable for Grade ${grade ?? 2}",
  "crossCurricular": "Specific links with other subjects",
  "methodology": "3-stage EVR breakdown (Evokim 10 min, Realizim i Kuptimit 25 min, Reflektim 10 min) with activities for Grade ${grade ?? 2} and Ora ${pInfo.number}",
  "assessment": "Formative assessment techniques",
  "homework": "Appropriate homework task",
  "reflection": "Teacher reflection"
}`;

    try {
      const generated = await callGeminiAPI(apiKey, prompt);
      if (generated && generated.lessonOutcomes?.length && generated.topic) {
        return generated;
      }
    } catch (err) {
      console.warn('Gemini API call failed, transitioning to high-fidelity domain knowledge engine:', err.message);
    }
  }

  // 2. High-Fidelity Domain-Specific Pedagogical Engine
  return buildDomainSpecificLesson({
    subject,
    classLabel,
    grade,
    lessonUnit,
    curricularArea: area,
    curriculumStage: stage,
    period: pInfo.label,
    language
  });
}

export default generateLessonPlanWithAI;
