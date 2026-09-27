import { parseClassLabel, stageForClass, getSubjectArea } from '../features/lessonPlans/catalog.js';

/**
 * Universal Pedagogical Intelligence & Lesson Generator for LumiSchool
 * Formulates detailed, domain-specific, curriculum-accurate lesson plans
 * conforming to Kosovo & European (MASHTI) competency standards.
 * 
 * Takes into account:
 * 1. Subject (Lënda)
 * 2. Class/Grade (Klasa & Viti/Shkalla, e.g. II -> 2, X -> 10)
 * 3. Exact Lesson Unit (Njësia Mësimore)
 * 4. Lesson Period (Ora Mësimore 1, 2, 3...) - Differentiating:
 *    - Ora 1: Introduction, conceptual discovery, foundational rules & visual models
 *    - Ora 2: Structured drills, varied practice, edge cases & pair work
 *    - Ora 3: Real-world applied problem-solving, word problems & critical synthesis
 *    - Ora 4+: Consolidation, review & formative evaluation
 */

const clean = (val) => String(val || '').trim();

/**
 * Call Google Gemini API with strict pedagogical directives
 */
async function callGeminiAPI(apiKey, prompt) {
  // Prioritize smarter, next-gen Flash models (2.5 Flash / 3.5 Flash) without using expensive Pro tiers
  const models = [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
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
            maxOutputTokens: 3000,
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
      console.warn(`Gemini model ${model} attempt notice:`, err.message);
    }
  }

  throw lastError || new Error('Failed to reach Gemini API');
}

/**
 * Normalize and parse "Ora mësimore" (Period)
 */
function parsePeriod(periodStr) {
  if (!periodStr) return { number: 1, label: '1', stage: 'Hyrje / Konceptet Bazë' };
  const raw = String(periodStr).trim();
  const match = raw.match(/\d+/);
  const num = match ? parseInt(match[0], 10) : 1;
  
  let stage = 'Hyrje / Konceptet Bazë';
  if (num === 2) stage = 'Përforcim & Ushtrime Praktike';
  else if (num === 3) stage = 'Zbatim në Jetën Reale & Problema';
  else if (num >= 4) stage = 'Konsolidim & Vlerësim Formativ';

  return { number: num, label: String(num), stage };
}

/**
 * Comprehensive Pedagogical Domain Engine
 * Produces deep, tailored, authentic lesson plans for ANY subject, unit, and period.
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
  const unitLower = unitRaw.toLowerCase();
  const subjRaw = clean(subject);
  const subjLower = subjRaw.toLowerCase();
  const gr = grade !== null && grade !== undefined ? grade : 3;
  const stage = curriculumStage || (gr <= 2 ? 'Shkalla I' : gr <= 5 ? 'Shkalla II' : gr <= 7 ? 'Shkalla III' : gr <= 9 ? 'Shkalla IV' : gr <= 11 ? 'Shkalla V' : 'Shkalla VI');
  const pInfo = parsePeriod(period);
  const pNum = pInfo.number;

  // ==========================================================================
  // 1. MATHEMATICS (Matematikë)
  // ==========================================================================

  // 1A. Rounding / Rrumbullakimi i numrave
  if (unitLower.includes('rrumbullak') || unitLower.includes('rounding')) {
    if (pNum === 1) {
      return {
        topic: `Rrumbullakimi i numrave natyrorë në dhjetëshen më të afërt — Boshti numerik dhe rregulla themelore (Ora 1)`,
        topicLearningOutcome: `Nxënësi/ja kupton arsyen praktike të përafrimit të sasive dhe mëson rregullën e rrumbullakimit të numrave natyrorë në dhjetëshen më të afërt duke përdorur boshtin numerik për klasën ${classLabel || gr}.`,
        competencyOutcomes: [
          `Kompetenca e të menduarit: Analizon shifrën e dhjetësheve dhe shifrën fqinje të njësheve për të zbatuar rregullën 0-4 (poshtë) dhe 5-9 (lart).`,
          `Kompetenca e komunikimit: Shpjegon me fjalor të saktë matematikor vendndodhjen e numrit midis dy dhjetësheve kufitare.`,
          `Kompetenca e të nxënit: Përdor boshtin numerik si model vizualizimi dhe vetëvlerëson saktësinë e përafrimeve të kryera.`,
          `Kompetenca personale: Bashkëpunon në çifte duke shpjeguar arsyen e zgjedhjes së dhjetëshes më të afërt.`
        ],
        fieldOutcomes: [
          `Zbaton vlerën e vendit të shifrave për të përcaktuar me saktësi përafrimin e numrave natyrorë.`,
          `Paraqet dhe interpreton marrëdhëniet e numrave në boshtin numerik.`
        ],
        keywords: `rrumbullakim, dhjetëshe më e afërt, boshti numerik, shifra e njësheve, rregulla 0-4 dhe 5-9, përafrim sasior, simboli ≈`,
        lessonOutcomes: [
          `Dallon shifrën e dhjetësheve dhe shifrën e njësheve në numra dyshifrorë dhe treshifrorë.`,
          `Gjen në boshtin numerik dy dhjetëshet e plota midis të cilave ndodhet një numër dhe tregon cila është më pranë tij (p.sh. 47 është midis 40 e 50, më afër 50).`,
          `Zbaton rregullën: nëse shifra e fundit është 0, 1, 2, 3, 4 numri rrumbullakohet poshtë; nëse është 5, 6, 7, 8, 9 rrumbullakohet lart.`,
          `Shpjegon me gojë pse numrat me 5 në fund (si 25, 45, 75) sipas marrëveshjes matematikore rrumbullakohen te dhjetëshja më e madhe.`
        ],
        successCriteria: [
          `Unë mund të qarkoj shifrën e njësheve për të vendosur drejtimin e rrumbullakimit.`,
          `Unë mund të vendos numra në boshtin numerik dhe të gjej dhjetëshen më të afërt.`,
          `Unë mund të rrumbullakoj saktë numra si 24 në 20, 68 në 70 dhe 85 në 90.`,
          `Unë mund të përdor saktë shenjën e përafrimit (≈) në fletore.`
        ],
        resources: `Teksti i Matematikës ${classLabel || gr}, boshti numerik në tabelë dhe fletore, kartela me ngjyra për shifrat 0-4 dhe 5-9, fletë pune me ushtrime bazë.`,
        crossCurricular: `Gjuhë shqipe (terminologjia "përafërsisht", "kufitare"), Edukatë qytetare (çmimet dhe blerjet në dyqan).`,
        methodology: `Struktura EVR — Ora 1 (Hyrje & Zbulim i Rregullës):\n\n` +
          `1. Evokimi (10 min): Pyetje nxitëse: "Një libër kushton 48 cent. Sa monedha 10-centëshe na duhen afërsisht?" Diskutim mbi konceptin "afërsisht". Vizatimi i boshtit numerik 40-50.\n` +
          `2. Realizimi i Kuptimit (25 min): Vëzhgimi i distancave në bosht. Formulimi i rregullës 0-4 dhe 5-9. Modelimi i 4 shembujve në tabelë (32≈30, 47≈50, 75≈80, 89≈90). Punë e pavarur me 8 ushtrime në fletë pune.\n` +
          `3. Reflektimi (10 min): Loja me kartela "Kush është dhjetëshja ime?" dhe vetëvlerësimi i kritereve të suksesit.`,
        assessment: `Vlerësim formativ përmes vëzhgimit të punës në bosht numerik, pyetjeve diagnostikuese dhe kontrollit të ushtrimeve në fletore.`,
        homework: `Fletore pune: Ushtrimet 1 deri 4 mbi rrumbullakimin në dhjetëshen më të afërt.`,
        reflection: `Përdorimi i boshtit numerik e bëri konceptin të kuptueshëm menjëherë. Në orën 2 do të kalohet në numra më të mëdhenj dhe qindëshe.`
      };
    } else if (pNum === 2) {
      return {
        topic: `Rrumbullakimi në dhjetëshen dhe qindëshen më të afërt — Ushtrime praktike dhe raste të veçanta (Ora 2)`,
        topicLearningOutcome: `Nxënësi/ja zgjeron shprehitë e rrumbullakimit duke trajtuar numra treshifrorë në dhjetëshe dhe qindëshe, si dhe raste të veçanta për klasën ${classLabel || gr}.`,
        competencyOutcomes: [
          `Kompetenca e të menduarit: Krahason rezultatet e rrumbullakimit të të njëjtit numër në dhjetëshe dhe në qindëshe.`,
          `Kompetenca e të nxënit: Bashkëpunon në çifte për të gjetur dhe korrigjuar gabimet tipike gjatë përafrimit.`
        ],
        fieldOutcomes: [
          `Zbaton rregullat e përafrimit në numra treshifrorë dhe katërshifrorë.`,
          `Zgjedh me vetëdije shifrën përcaktuese sipas rendit të kërkuar (njëshet për dhjetëshen, dhjetëshet për qindëshen).`
        ],
        keywords: `dhjetëshe e plotë, qindëshe e plotë, raste kufitare, shifër përcaktuese, ushtrime praktike, krahasim rezultatesh`,
        lessonOutcomes: [
          `Rrumbullakon me shpejtësi numra treshifrorë në dhjetëshen më të afërt (p.sh. 346 ≈ 350, 782 ≈ 780).`,
          `Zbaton rregullën për qindëshen më të afërt duke vëzhguar shifrën e dhjetësheve (p.sh. 430 ≈ 400, 470 ≈ 500).`,
          `Zgjidh raste sfiduese kur shifra 9 rritet dhe kalon në rendin më të lartë (p.sh. 197 ≈ 200, 395 ≈ 400).`,
          `Zbulon dhe korrigjon gabimet e qëllimshme në shembujt e vendosur në tabelë.`
        ],
        successCriteria: [
          `Unë mund të rrumbullakoj një numër treshifror si në dhjetëshe ashtu edhe në qindëshe.`,
          `Unë mund të shpjegoj cila shifër merret parasysh për qindëshen e plotë.`,
          `Unë mund të korrigjoj llogaritjet e gabuara në fletën e punës së shokut/shoqes.`
        ],
        resources: `Teksti mësimor, fletë pune me 3 kolona (Numri | Dhjetëshja | Qindëshja), tabela e bardhë, kartela sfiduese.`,
        crossCurricular: `Gjuhë shqipe (argumentimi logjik), TIK (kontrolli me kalkulator).`,
        methodology: `Struktura EVR — Ora 2 (Përforcim & Ushtrime në Çifte):\n\n` +
          `1. Evokimi (8 min): Përsëritje e rrufe e rregullës 0-4 dhe 5-9 me kartela numrash.\n` +
          `2. Realizimi i Kuptimit (27 min): Zgjerimi te qindëshet. Trajtimi i rasteve me 9 (196≈200). Punë në çifte me tabela krahasimi. Aktiviteti "Gjej gabimin e fshehur".\n` +
          `3. Reflektimi (10 min): Kuiz 3-minutësh "E vërtetë apo e gabuar" dhe korrigjim i përbashkët.`,
        assessment: `Kontrolli i fletëve të punës, vëzhgimi i punës në dyshe dhe pjesëmarrja aktive në gjetjen e gabimeve.`,
        homework: `Fletë pune: 10 ushtrime të përziera të rrumbullakimit në dhjetëshe dhe qindëshe.`,
        reflection: `Nxënësit treguan siguri të lartë. Rasti me shifrën 9 kërkoi pak më shumë shpjegim dhe u përvetësua mirë.`
      };
    } else {
      return {
        topic: `Rrumbullakimi i numrave — Zbatimi në llogaritje të përafërta dhe zgjidhje problemash jetësore (Ora ${pNum})`,
        topicLearningOutcome: `Nxënësi/ja zbaton rrumbullakimin e numrave për të llogaritur shumat dhe diferencat e përafërta në situata reale dhe blerje për klasën ${classLabel || gr}.`,
        competencyOutcomes: [
          `Kompetenca e të menduarit: Vlerëson me arsyetim kritik nëse mjafton një vlerë e përafërt apo kërkohet rezultat ekzakt.`,
          `Kompetenca qytetare: Menaxhon buxhete të thjeshta financiare duke përdorur numra të rrumbullakosur.`
        ],
        fieldOutcomes: [
          `Zgjidh problema nga jeta e përditshme duke përdorur vlerësimin me përafrim të shumave dhe zbritjeve.`,
          `Krahason vlerën ekzakte me vlerën e përafërt dhe nxjerr përfundime logjike.`
        ],
        keywords: `llogaritje e përafërt, vlerësim shume, diferencë e përafërt, buxhet, blerje, situatë problemore, vendimmarrje`,
        lessonOutcomes: [
          `Llogarit me mend shumën e përafërt të dy numrave duke i rrumbullakosur paraprakisht (p.sh. 48 + 33 ≈ 50 + 30 = 80).`,
          `Zgjidh problema me tekst nga situata reale blerjesh ose udhëtimesh.`,
          `Krahason rezultatin ekzakt me atë të përafërt dhe shpjegon diferencën midis tyre.`,
          `Krijon një problemë të vetën me fjalë për shokët e klasës duke përdorur të dhëna reale.`
        ],
        successCriteria: [
          `Unë mund të llogaris me mend koston e përafërt të artikujve në dyqan para pagesës.`,
          `Unë mund të zgjidh një problemë praktike duke shkruar barazimin me shenjën ≈.`,
          `Unë mund të shpjegoj kur është i domosdoshëm numërimi i saktë dhe kur mjafton përafrimi.`
        ],
        resources: `Katalogë reklamash me çmime reale, fletore pune, fletë problemash në grupe.`,
        crossCurricular: `Edukatë financiare (kursimi dhe buxheti), Gjuhë shqipe (leximi dhe formulimi i problemave).`,
        methodology: `Struktura EVR — Ora ${pNum} (Zbatim Praktik & Problema):\n\n` +
          `1. Evokimi (10 min): Simulimi "Në dyqan me buxhet 20 euro": Libri 8.90€, fletorja 3.80€, lapsat 2.10€. A mjaftojnë paratë? Llogaritje me mend: 9+4+2=15€.\n` +
          `2. Realizimi i Kuptimit (25 min): Modelimi i zgjidhjes me hapa (rrumbullakim të dhënash, mbledhje e përafërt, krahasim me vlerën e saktë). Punë në grupe me 3 situata problemore.\n` +
          `3. Reflektimi (10 min): Prezantimi i zgjidhjeve nga grupet dhe diskutim mbi rëndësinë e përafrimit në jetë.`,
        assessment: `Vlerësim formativ i zgjidhjes së problemës në grup, saktësisë së llogaritjes me mend dhe arsyetimit kritik.`,
        homework: `Krijoni në shtëpi një faturë imagjinare me 3 artikuj dhe llogaritni shumën e saktë dhe atë të përafërt.`,
        reflection: `Nxënësit u motivuan shumë nga shembujt e jetës reale. Lidhja me menaxhimin e parave e bëri orën tejet praktike.`
      };
    }
  }

  // 1B. Fractions / Thyesat
  if (unitLower.includes('thyes') || unitLower.includes('fraction')) {
    const focus = pNum === 1 
      ? 'Kuptimi i thyesës si pjesë e së tërës, numëruesi dhe emëruesi (Ora 1)'
      : pNum === 2 
        ? 'Krahasimi i thyesave me emërues të njëjtë dhe paraqitja në bosht (Ora 2)'
        : `Zbatimi i thyesave në zgjidhje problemash dhe pjesë të grupit (Ora ${pNum})`;

    return {
      topic: `Thyesat — ${focus}`,
      topicLearningOutcome: `Nxënësi/ja përvetëson kuptimin e thyesës, dallon rolin e numëruesit dhe emëruesit dhe kryen veprime e krahasime thyesore për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Ndan figura gjeometrike në pjesë të barabarta dhe i paraqet ato me shprehje thyesore.`,
        `Kompetenca e komunikimit: Shpjegon saktë kuptimin e emëruesit (në sa pjesë ndahet) dhe numëruesit (sa pjesë merren).`
      ],
      fieldOutcomes: [
        `Përdor thyesat për të përshkruar pjesë të figurave dhe pjesë të koleksioneve të sendeve.`,
        `Paraqet thyesat vizualisht dhe në bosht numerik.`
      ],
      keywords: `thyesë, emërues, numërues, vija e thyesës, pjesë e barabartë, gjysma (1/2), çereku (1/4), bosht numerik`,
      lessonOutcomes: [
        `Dallon dhe emërton elementet e thyesës: numëruesin, emëruesin dhe vijën e thyesës.`,
        `Ndan me saktësi figura gjeometrike në pjesë të barabarta dhe ngjyros pjesën e përcaktuar nga thyesa.`,
        `Krahason thyesa të thjeshta me emërues të njëjtë duke përdorur modele konkrete (p.sh. 3/4 > 1/4).`,
        `Zgjidh ushtrime praktike të ndarjes së ushqimeve ose objekteve në mënyrë të barabartë.`
      ],
      successCriteria: [
        `Unë mund të shpjegoj çfarë tregon numri lart dhe numri poshtë në një thyesë.`,
        `Unë mund të vizatoj dhe të ngjyros pjesën e kërkuar të një rrethi apo drejtkëndëshi.`,
        `Unë mund të shkruaj thyesën e saktë për pjesën e pangjyrosur.`,
        `Unë mund të krahasoj dy thyesa me emërues të barabartë.`
      ],
      resources: `Teksti mësimor, disqe dhe shirita thyesorë, fletë me figura gjeometrike për palosje, fletore pune.`,
      crossCurricular: `Art pamor (ngjyrosja e modeleve thyesore), Edukatë shëndetësore (ndarja e porcioneve ushqimore).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Palosja e shiritave të letrës në 2, 4 dhe 8 pjesë të barabarta. Diskutim mbi rëndësinë e barazisë së pjesëve.\n` +
        `2. Realizimi i Kuptimit (25 min): Prezantimi i numëruesit dhe emëruesit me shembullin e picës/çokollatës. Punë e drejtuar me vizatime në tabelë. Ushtrime praktike në fletore pune.\n` +
        `3. Reflektimi (10 min): Loja "Bingo me thyesa" dhe vetëvlerësimi i kritereve.`,
      assessment: `Vlerësim formativ i palosjes së letrave, saktësisë së shkrimit të thyesave dhe ushtrimeve individuale.`,
      homework: `Plotësimi i faqes përkatëse në fletoren e punës dhe vizatimi i 3 modeleve thyesore në fletore.`,
      reflection: `Palosja konkrete e letrave e bëri konceptin abstrakt shumë të prekshëm dhe të lehtë për nxënësit.`
    };
  }

  // 1C. Multiplication & Division / Shumëzimi dhe Pjesëtimi
  if (unitLower.includes('shumëzim') || unitLower.includes('pjesëtim') || unitLower.includes('multiplication') || unitLower.includes('division')) {
    const isMult = unitLower.includes('shumëzim') || unitLower.includes('multiplication');
    const opName = isMult ? 'Shumëzimi' : 'Pjesëtimi';
    const focus = pNum === 1 
      ? `Kuptimi i ${opName.toLowerCase()}t, termat themelorë dhe tabela (Ora 1)` 
      : pNum === 2 
        ? `Ushtrime zbatuese, vetitë dhe marrëdhënia e anasjelltë (Ora 2)` 
        : `Zgjidhje problemash nga jeta reale dhe arsyetim logjik (Ora ${pNum})`;

    return {
      topic: `${opName} — ${focus}`,
      topicLearningOutcome: `Nxënësi/ja përvetëson konceptin e ${opName.toLowerCase()}t, zbaton rregullat dhe vetitë llogaritëse dhe zgjidh situata problemore për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Përdor marrëdhënien midis shumëzimit dhe pjesëtimit për të vërtetuar dhe provuar saktësinë e llogaritjeve.`,
        `Kompetenca e komunikimit: Shpjegon me fjalor të saktë rolin e faktorëve, prodhimit, të pjesëtueshmit dhe herësit.`
      ],
      fieldOutcomes: [
        `Kryen veprimet e ${opName.toLowerCase()}t me saktësi dhe shpejtësi.`,
        `Modelon situata praktike të grupimit dhe shpërndarjes së barabartë.`
      ],
      keywords: `${opName.toLowerCase()}, faktor, prodhim, i pjesëtueshëm, pjesëtues, herës, provë, grupim i barabartë`,
      lessonOutcomes: [
        `Emërton termat përbërës të veprimit të ${opName.toLowerCase()}t.`,
        `Kryen llogaritje të sakta duke përdorur tabelën dhe strategjitë e thjeshtimit.`,
        `Zbaton vetitë e veprimit (ndërrimi, shoqërimi ose shpërndarja) për llogaritje më të shpejtë.`,
        `Zgjidh problema me tekst që kërkojnë veprimin e ${opName.toLowerCase()}t.`
      ],
      successCriteria: [
        `Unë mund të gjej menjëherë rezultatin e llogaritjeve nga tabela bazë.`,
        `Unë mund të bëj provën e veprimit për të kontrolluar saktësinë time.`,
        `Unë mund të zgjidh një problemë me fjalë duke shkruar barazimin e saktë.`
      ],
      resources: `Teksti mësimor, tabela e shumëzimit/pjesëtimit, kube numëruese, fletë pune me ushtrime të shpejta.`,
      crossCurricular: `Gjuhë shqipe (krijimi i problemave me fjalë), Edukatë muzikore (ritmi i numërimit me hapa).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Numërim me kapërcim në kor dhe pyetje rrufe për nxehje mendore.\n` +
        `2. Realizimi i Kuptimit (25 min): Demonstrimi i veprimit me grupe sendesh konkrete. Modelimi në tabelë. Punë në çifte me kartela veprimesh dhe ushtrime në fletë pune.\n` +
        `3. Reflektimi (10 min): Loja me stafetë në tabelë "Kush llogarit më shpejt" dhe vetëvlerësimi.`,
      assessment: `Vlerësim formativ përmes vëzhgimit të llogaritjeve gojore, kontrollit të ushtrimeve me shkrim dhe provës së veprimit.`,
      homework: `Zgjidhja e ushtrimeve përkatëse në fletoren e punës dhe mësimi i tabelës.`,
      reflection: `Përdorimi i provës së anasjelltë u dha nxënësve vetëbesim për të vetëkorrigjuar llogaritjet.`
    };
  }

  // 1D. Geometry: Area, Perimeter, Shapes / Gjeometri, Sipërfaqja, Perimetri
  if (unitLower.includes('gjeometri') || unitLower.includes('perimetr') || unitLower.includes('sipërfaq') || unitLower.includes('kënd') || unitLower.includes('trekëndësh') || unitLower.includes('drejtkëndësh')) {
    const isPerimeter = unitLower.includes('perimetr');
    const isArea = unitLower.includes('sipërfaq');
    const topicFocus = isPerimeter ? 'Perimetri i figurave plane' : isArea ? 'Sipërfaqja dhe njësitë katrore' : 'Figurat gjeometrike dhe vetitë e tyre';

    return {
      topic: `${topicFocus} — Matja, formulat dhe zbatimi praktik (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja dallon vetitë e figurave gjeometrike, përdor mjetet matëse dhe zbaton formulat e përllogaritjes për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Zbaton formulat gjeometrike në situata konkrete të matjes së mjedisit rrethues.`,
        `Kompetenca e të nxënit: Përdor vizoren dhe mjetet gjeometrike me saktësi teknike.`
      ],
      fieldOutcomes: [
        `Mat dhe llogarit përmasat e figurave gjeometrike duke përdorur njësitë e duhura standarde.`,
        `Ndërton figura gjeometrike sipas përmasave të dhëna.`
      ],
      keywords: `gjeometri, brinjë, kulm, perimetër, sipërfaqe, drejtkëndësh, katror, njësi matëse (cm, m, cm²), vizore`,
      lessonOutcomes: [
        `Identifikon brinjët, kulmet dhe këndet e figurave gjeometrike të shqyrtuara.`,
        `Mat me saktësi me vizore gjatësitë e brinjëve në fletore dhe objekte të klasës.`,
        `Zbaton formulën e përllogaritjes (mungesa e brinjëve, perimetri, sipërfaqja).`,
        `Zgjidh problema praktike të rrethimit të oborrit, parketit apo kornizës së fotografive.`
      ],
      successCriteria: [
        `Unë mund të mat me vizore çdo brinjë të figurës pa gabim në milimetra.`,
        `Unë mund të shkruaj formulën e duhur përpara se të kryej llogaritjen.`,
        `Unë mund të vendos gjithmonë njësinë e saktë matëse pranë rezultatit (cm ose cm²).`
      ],
      resources: `Teksti mësimor, vizore, trekëndësh gjeometrik, metër shirit, fletë me rrjetë katrorësh, modele kartoni.`,
      crossCurricular: `Art pamor (kompozimi me forma gjeometrike), TIK (programet e vizatimit gjeometrik).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Gjetja e formave gjeometrike në klasë (tabela, dritarja, banka) dhe pyetja: "Si e dimë sa material duhet për kornizën?"\n` +
        `2. Realizimi i Kuptimit (25 min): Nxjerrja e formulës përmes mbledhjes së gjatësive të brinjëve. Matja praktike e librit dhe fletores me vizore. Zgjidhja e shembujve në tabelë dhe ushtrimeve të tekstit.\n` +
        `3. Reflektimi (10 min): Matja e shpejtë e një objekti vetjak dhe prezantimi i rezultatit.`,
      assessment: `Vlerësim formativ i saktësisë së matjes me vizore, zbatimit të formulës në fletore dhe bashkëpunimit në dyshe.`,
      homework: `Matni në shtëpi perimetrin ose sipërfaqen e dy objekteve (p.sh. tavolinës dhe kornizës) dhe shënoni llogaritjet në fletore.`,
      reflection: `Matja e objekteve reale të klasës e ktheu mësimin në një përvojë tejet konkrete dhe interesante.`
    };
  }

  // ==========================================================================
  // 2. LANGUAGE & GRAMMAR (Gjuhë Shqipe / Gjuhë Angleze)
  // ==========================================================================

  // 2A. Verbs & Tenses / Folja dhe Kohët
  if (unitLower.includes('folj') || unitLower.includes('kohët') || unitLower.includes('zgjedhim') || unitLower.includes('verb') || unitLower.includes('tense')) {
    const focus = pNum === 1 
      ? `Zbulimi i foljes, kuptimi i veprimit/gjendjes dhe koha e tashme (Ora 1)` 
      : pNum === 2 
        ? `Zgjedhimi në kohë të ndryshme, vetat dhe përshtatja me kryefjalën (Ora 2)` 
        : `Përdorimi i foljeve në tekste përshkruese dhe tregimtare (Ora ${pNum})`;

    return {
      topic: `Folja — ${focus}`,
      topicLearningOutcome: `Nxënësi/ja dallon foljet si pjesë e ndryshueshme e ligjëratës, përcakton kohën dhe vetën e tyre dhe i përdor saktë në të folur e të shkruar për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e komunikimit: Përdor format e duhura të foljes duke ruajtur përshtatjen gramatikore me kryefjalën.`,
        `Kompetenca e të menduarit: Analizon dhe krahason ndryshimet e mbaresave foljore sipas kohëve dhe vetave.`
      ],
      fieldOutcomes: [
        `Dallon foljet dhe kategoritë e tyre gramatikore në tekste të ndryshme.`,
        `Zbaton rregullat e drejtshkrimit të foljeve gjatë shkrimit të teksteve vetjake.`
      ],
      keywords: `folje, veprim, gjendje, koha e tashme, koha e kryer, koha e ardhme, veta, numri, zgjedhim, mbaresa`,
      lessonOutcomes: [
        `Dallon foljet në fjali duke bërë pyetjet përkatëse (Ç'bën? Ç'bëri? Ç'do të bëjë?).`,
        `Zgjedhon folje të rregullta në kohën e caktuar sipas vetave në njëjës dhe shumës.`,
        `Identifikon dhe korrigjon përdorimin e gabuar të mbaresave foljore në fjali të dhëna.`,
        `Ndërton një paragraf të shkurtër duke përdorur folje dinamike dhe të sakta.`
      ],
      successCriteria: [
        `Unë mund të gjej dhe të nënvizoj të gjitha foljet në një paragraf të shkurtër.`,
        `Unë mund të zgjedhoj saktë një folje në të 6 vetat pa ngatërruar mbaresat.`,
        `Unë mund të përshtat foljen me përemrin vetor përkatës (unë, ti, ai/ajo, ne, ju, ata/ato).`
      ],
      resources: `Teksti i Gjuhës Shqipe ${classLabel || gr}, tabela me skemën e zgjedhimit, kartela foljesh, fletore pune.`,
      crossCurricular: `Letërsi (analiza e veprimeve të personazheve), Edukatë qytetare (bashkëbisedimi me mirësjellje).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Loja e mimikës: një nxënës demonstron një veprim pa zë (lexon, vrapon, këndon), të tjerët e gjejnë fjalën. Çfarë tregojnë këto fjalë?\n` +
        `2. Realizimi i Kuptimit (25 min): Prezantimi i tabelës së zgjedhimit dhe mbaresave kryesore. Punë e drejtuar me 2 folje model në tabelë. Punë në çifte me fletë ushtrimesh të plotësimit të fjalive.\n` +
        `3. Reflektimi (10 min): Loja me stafetë "Kush e zgjedhon i pari" dhe vetëvlerësimi.`,
      assessment: `Vlerësim formativ i saktësisë së dallimit të foljes, zgjedhimit me shkrim në fletore dhe pjesëmarrjes aktive.`,
      homework: `Zgjedhoni 2 folje të reja në fletore dhe formoni me to 4 fjali me kuptim.`,
      reflection: `Loja e mimikës në hyrje të orës tërhoqi vëmendjen e të gjithë nxënësve dhe lehtësoi përvetësimin e mbaresave.`
    };
  }

  // 2B. Syntax: Sentence Structure, Subject & Predicate / Fjalia, Kryefjala dhe Kallëzuesi
  if (unitLower.includes('kryefjal') || unitLower.includes('kallëzues') || unitLower.includes('sintaks') || unitLower.includes('fjali') || unitLower.includes('syntax') || unitLower.includes('sentence')) {
    return {
      topic: `Gjymtyrët kryesore të fjalisë — Kryefjala dhe Kallëzuesi (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja dallon gjymtyrët kryesore të fjalisë, kupton rolin e tyre sintaksor dhe ndërton fjali gramatikisht të sakta për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e komunikimit: Ndërton fjali me strukturë të qartë logjike dhe sintaksore.`,
        `Kompetenca e të menduarit: Analizon marrëdhëniet midis kryefjalës dhe kallëzuesit duke përdorur pyetjet drejtuese.`
      ],
      fieldOutcomes: [
        `Analizon strukturën e fjalive të thjeshta duke dalluar gjymtyrët kryesore dhe ato të dyta.`,
        `Përdor me saktësi shenjat e pikësimit në fund të fjalive.`
      ],
      keywords: `fjali, gjymtyrë kryesore, kryefjala, kallëzuesi, pyetjet drejtuese (Kush? Ç'bën?), përshtatje, skemë sintaksore`,
      lessonOutcomes: [
        `Dallon kryefjalën në fjali me anë të pyetjeve: Kush? Cili? Cilët? Cilat?.`,
        `Dallon kallëzuesin me anë të pyetjeve: Ç'bën? Ç'bëjnë?.`,
        `Përcakton me çfarë shprehet kryefjala (emër, përemër) dhe me çfarë kallëzuesi (folje).`,
        `Bashkon kryefjalë dhe kallëzues të dhënë për të formuar fjali me kuptim të plotë.`
      ],
      successCriteria: [
        `Unë mund të nënvizoj me një vijë kryefjalën dhe me dy vija kallëzuesin.`,
        `Unë mund të bëj pyetjen e saktë për të gjetur secilën gjymtyrë kryesore.`,
        `Unë mund të korrigjoj fjalitë ku mungon njëra prej gjymtyrëve kryesore.`
      ],
      resources: `Teksti mësimor, shirita fjalish me ngjyra, tabela e bardhë, fletore pune.`,
      crossCurricular: `Të gjitha lëndët (shprehja e qartë me fjali të plota).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Leximi i fjalive të papërfunduara (p.sh. "... vrapon me shpejtësi në fushë"). Çfarë mungon që fjalia të ketë kuptim?\n` +
        `2. Realizimi i Kuptimit (25 min): Përcaktimi i kryefjalës dhe kallëzuesit me pyetjet model. Nënvizimi me konvencione (1 vijë / 2 vija). Punë në dyshe me fletë ushtrimesh.\n` +
        `3. Reflektimi (10 min): Loja e bashkimit të shiritave të fjalive dhe vetëvlerësimi.`,
      assessment: `Kontrolli i nënvizimit të saktë në fletore, përgjigjet e pyetjeve drejtuese dhe ndërtimi i fjalive origjinale.`,
      homework: `Gjeni në një tekst letrar 5 fjali, shkruajini në fletore dhe nënvizoni kryefjalën dhe kallëzuesin.`,
      reflection: `Metoda me pyetjet drejtuese ndihmoi të gjithë nxënësit të gjejnë menjëherë boshtin e fjalisë.`
    };
  }

  // 2C. Reading & Literary Text Analysis / Përralla, Tregimi, Poezia
  if (unitLower.includes('tregim') || unitLower.includes('përrall') || unitLower.includes('poezi') || unitLower.includes('varg') || unitLower.includes('letërsi') || unitLower.includes('story') || unitLower.includes('poem')) {
    return {
      topic: `Analizë teksti letrar: "${unitRaw}" — Personazhet, ngjarja dhe mesazhi edukativ (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja lexon me rrjedhshmëri dhe intonacion tekstin letrar, analizon veprimet e personazheve dhe nxjerr mesazhin kryesor për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e komunikimit: Shpreh përjetimet emocionale dhe gjykimet vetjake rreth ngjarjeve të tekstit.`,
        `Kompetenca personale: Vlerëson sjelljet pozitive të personazheve dhe i krahason me situata të jetës së përditshme.`
      ],
      fieldOutcomes: [
        `Interpreton kuptimin e tekstit letrar përmes leximit me role dhe diskutimit të hapur.`,
        `Përshkruan cilësitë fizike dhe morale të personazheve kryesore dhe dytësore.`
      ],
      keywords: `lexim shprehës, personazhe, ngjarje, hyrje, zhvillim, pikë kulmore, mbyllje, mesazhi edukativ, fjalor i ri`,
      lessonOutcomes: [
        `Lexon tekstin qartë, me intonacion dhe duke respektuar shenjat e pikësimit.`,
        `Përcakton strukturën e tregimit: vendin, kohën dhe rrjedhën e ngjarjes.`,
        `Analizon personazhet kryesore duke veçuar cilësitë e tyre pozitive dhe negative.`,
        `Formulon me fjalët e veta mesazhin dhe mësimin që përcjell pjesa letrare.`
      ],
      successCriteria: [
        `Unë mund të lexoj rrjedhshëm një fragment para klasës me intonacionin e duhur.`,
        `Unë mund të plotësoj hartën e ngjarjes (kush, ku, kur, çfarë ndodhi).`,
        `Unë mund të shpjegoj mesazhin kryesor që nxjerrim nga kjo pjesë letrare.`
      ],
      resources: `Teksti i Leximit ${classLabel || gr}, ilustrime të tekstit, tabakë letre për hartën e tregimit, fletore pune.`,
      crossCurricular: `Art pamor (vizatimi i skenës më mbresëlënëse), Edukatë qytetare (vlerat e miqësisë dhe ndershmërisë).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Parashikimi me terma kyç ose vëzhgimi i ilustrimit të titullit: "Çfarë mendoni se do të ndodhë?"\n` +
        `2. Realizimi i Kuptimit (25 min): Lexim i drejtuar dhe lexim me role. Shpjegimi i fjalëve të reja të fjalorit. Diskutim me pyetje kuptimore. Plotësimi i diagramit të personazheve në grupe.\n` +
        `3. Reflektimi (10 min): Diskutimi i mesazhit: "Si do të veproje ti në vend të personazhit?" dhe vetëvlerësimi.`,
      assessment: `Vlerësim formativ i leximit shprehës, të kuptuarit të tekstit dhe thellësisë së analizës së personazheve.`,
      homework: `Rilexoni tekstin rrjedhshëm dhe shkruani në fletore 4 fjali me mesazhin e pjesës.`,
      reflection: `Nxënësit u lidhën ngushtë me dilemat e personazhit kryesor dhe zhvilluan një diskutim shumë të pjekur etik.`
    };
  }

  // ==========================================================================
  // 3. NATURAL SCIENCES (Dituri Natyre / Biologji / Fizikë / Kimi)
  // ==========================================================================

  // 3A. Human Body, Circulation, Respiration / Trupi i Njeriut, Qarkullimi i Gjakut
  if (unitLower.includes('gjak') || unitLower.includes('zemër') || unitLower.includes('frymëmarr') || unitLower.includes('trup') || unitLower.includes('organ') || unitLower.includes('circulation') || unitLower.includes('heart')) {
    return {
      topic: `Trupi i njeriut — ${unitRaw}: Ndërtimi, funksioni dhe kujdesi shëndetësor (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja kupton ndërtimin dhe funksionimin e sistemit trupor, shpjegon rolin jetik të organeve kryesore dhe përvetëson shprehi të jetesës së shëndetshme për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Lidh ndërtimin anatomik të organeve me funksionin fiziologjik që ato kryejnë.`,
        `Kompetenca personale: Zbaton rregulla praktike të ushqyerjes dhe aktivitetit fizik për mirëmbajtjen e trupit.`
      ],
      fieldOutcomes: [
        `Përshkruan sistemet kryesore të organizmit të njeriut dhe ndërvarësinë mes tyre.`,
        `Demonstron matje të thjeshta fiziologjike (p.sh. rrahjet e zemrës/pulsi para dhe pas aktivitetit).`
      ],
      keywords: `organizëm, zemra, enët e gjakut (arteriet, venat, kapilarët), oksigjen, lëndë ushqyese, puls, shëndet, higjienë`,
      lessonOutcomes: [
        `Emërton organet përbërëse dhe tregon vendndodhjen e tyre në trupin e njeriut.`,
        `Shpjegon si qarkullon gjaku/ajri dhe si transportohen oksigjeni e lëndët ushqyese te qelizat.`,
        `Mat pulsin vetjak në gjendje qetësie dhe krahason vlerën pas një ushtrimi të shpejtë fizik.`,
        `Liston së paku 3 rregulla të rëndësishme për mbrojtjen e këtij sistemi jetik.`
      ],
      successCriteria: [
        `Unë mund të tregoj në një skicë anatomike rrugën që përshkon gjaku/ajri në trup.`,
        `Unë mund të gjej dhe të numëroj rrahjet e pulsit tim për 1 minutë.`,
        `Unë mund të shpjegoj pse zemra rreh më shpejt kur vrapojmë.`
      ],
      resources: `Teksti mësimor, modeli 3D i trupit të njeriut, postera anatomikë me ngjyra, kronometër për matjen e pulsit.`,
      crossCurricular: `Edukatë fizike (ndikimi i stërvitjes në rrahjet e zemrës), Matematikë (llogaritja dhe krahasimi i pulsit).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Vendosja e dorës në anën e majtë të kraharorit. Dëgjimi i të rrahurave. Pyetja: "Pse zemra nuk pushon kurrë?"\n` +
        `2. Realizimi i Kuptimit (25 min): Prezantimi me skicë me ngjyra (gjaku me oksigjen - i kuq, gjaku me dioksid karboni - i kaltër). Aktiviteti praktik: matja e pulsit në qetësi dhe pas 10 kërcimeve. Plotësimi i diagramit në fletore.\n` +
        `3. Reflektimi (10 min): Diskutimi mbi ushqimet e shëndetshme dhe rëndësinë e sportit.`,
      assessment: `Vlerësim formativ i matjes së pulsit, saktësisë së plotësimit të diagramit dhe të kuptuarit të funksionit të organeve.`,
      homework: `Vizato skemën e thjeshtë të qarkullimit në fletore dhe matni pulsin e një anëtari të familjes.`,
      reflection: `Eksperimenti i drejtpërdrejtë me matjen e pulsit e bëri orën jashtëzakonisht interaktive dhe të paharrueshme.`
    };
  }

  // 3B. Plants & Photosynthesis / Bimët dhe Fotosinteza
  if (unitLower.includes('bim') || unitLower.includes('fotosintez') || unitLower.includes('plant') || unitLower.includes('photosynthesis')) {
    return {
      topic: `Bota bimore — ${unitRaw}: Procesi jetik, klorofili dhe rëndësia për Tokën (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja kupton procesin e prodhimit të ushqimit te bimët, rolin e dritës dhe rëndësinë e oksigjenit për jetën në Tokë për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Analizon shndërrimin e energjisë diellore në energji kimike në natyrë.`,
        `Kompetenca qytetare: Zhvillon vetëdije ekologjike për ruajtjen e pyjeve dhe florës natyrore.`
      ],
      fieldOutcomes: [
        `Shpjegon përbërësit e nevojshëm dhe produktet e procesit të fotosintezës.`,
        `Kryen vëzhgime të gjetheve dhe klorofilit duke përdorur lente zmadhuese.`
      ],
      keywords: `fotosintezë, klorofil, drita e diellit, dioksid karboni, ujë, oksigjen, glukozë, gjethe, ekuilibër natyror`,
      lessonOutcomes: [
        `Identifikon faktorët thelbësorë që i duhen bimës për fotosintezë (drita, uji, CO₂).`,
        `Përshkruan rolin e klorofilit në thithjen e rrezeve të diellit.`,
        `Shpjegon se si bimët prodhojnë oksigjenin që thithin njerëzit dhe kafshët.`,
        `Argumenton pse gjethet janë quajtur "fabrika e ushqimit" të bimës.`
      ],
      successCriteria: [
        `Unë mund të shkruaj barazimin e thjeshtuar me fjalë: Ujë + Dioksid Karboni + Dritë = Ushqim + Oksigjen.`,
        `Unë mund të tregoj me shigjeta në vizatim çfarë hyn në gjethe dhe çfarë del prej saj.`,
        `Unë mund të argumentoj pse jeta në Tokë varet plotësisht nga bimët e gjelbra.`
      ],
      resources: `Teksti mësimor, gjethe të freskëta për vëzhgim, lupë zmadhuese, poster i fotosintezës, fletore pune.`,
      crossCurricular: `Gjeografi (mjediset bimore dhe pyjet globale), Kimi (gazrat e atmosferës).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Pyetja sfiduese: "Kafshët hanë ushqim, po bimët si ushqehen kur nuk kanë gojë?" Diskutim në dyshe.\n` +
        `2. Realizimi i Kuptimit (25 min): Vëzhgimi i gjetheve me lupë. Shpjegimi i thithjes së dritës nga klorofili. Vizatimi i skemës së fotosintezës në tabelë dhe fletore. Plotësimi i barazimit me fjalë.\n` +
        `3. Reflektimi (10 min): Diskutimi: "Çfarë do të ndodhte me ajrin nëse priten të gjitha pemët?" dhe vetëvlerësimi.`,
      assessment: `Kontrolli i saktësisë së vizatimit të gjethes dhe skemës, pyetjet diagnostikuese dhe arsyetimi ekologjik.`,
      homework: `Vizato në fletore ciklin e fotosintezës me ngjyra dhe shpjegoja atë një prindi.`,
      reflection: `Nxënësit u mahnitën nga zbulimi se oksigjeni që thithim vjen nga procesi i brendshëm i gjethes.`
    };
  }

  // 3C. Physics: Forces, Gravity, Friction / Forcat, Graviteti, Fërkimi
  if (unitLower.includes('forc') || unitLower.includes('fërkim') || unitLower.includes('gravitet') || unitLower.includes('shpejtësi') || unitLower.includes('force') || unitLower.includes('gravity') || unitLower.includes('friction')) {
    return {
      topic: `Fizikë — ${unitRaw}: Dukuritë e lëvizjes, ndikimi i fërkimit dhe graviteti (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja heton forcat që veprojnë mbi trupat, kupton ndikimin e gravitetit dhe fërkimit dhe kryen matje e parashikime fizike për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Parashikon lëvizjen e trupave në varësi të forcave që veprojnë mbi ta.`,
        `Kompetenca e të nxënit: Kryen hetime të thjeshta shkencore dhe regjistron të dhënat në tabela.`
      ],
      fieldOutcomes: [
        `Përshkruan llojet e forcave në natyrë (forca e rëndesës, forca e fërkimit, forca e shtytjes/tërheqjes).`,
        `Demonstron eksperimentalisht se si ashpërsia e sipërfaqes ndikon në madhësinë e fërkimit.`
      ],
      keywords: `forcë, bashkëveprim, graviteti, forca e rëndesës, fërkimi, lëvizje, sipërfaqe e lëmuar/e ashpër, dinamometër`,
      lessonOutcomes: [
        `Identifikon forcat që veprojnë mbi një trup në prehje dhe në lëvizje.`,
        `Shpjegon rolin e gravitetit në rënien e lirë të trupave drejt qendrës së Tokës.`,
        `Demonstron me shembuj konkretë dobinë dhe dëmin e fërkimit në jetën reale (ecja, frenimi i makinës).`,
        `Krahason shpejtësinë e rrëshqitjes së një trupi në sipërfaqe të ndryshme (dysheme, tapet, akull).`
      ],
      successCriteria: [
        `Unë mund të shpjegoj me fjalë të thjeshta çfarë është forca dhe si matet ajo.`,
        `Unë mund të tregoj dy shembuj ku fërkimi na ndihmon dhe një ku na pengon.`,
        `Unë mund të parashikoj saktë se mbi cilën sipërfaqe një lodër ecën më larg.`
      ],
      resources: `Teksti mësimor, makina lodër, rrafsh i pjerrët prej druri, copë tapeti, letër xhami, dinamometër.`,
      crossCurricular: `Siguri në rrugë (rëndësia e gomave dhe frenave në shi/borë), Matematikë (leximi i shkallës së dinamometrit).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Hedhja e një lapsi lart: "Pse bie gjithmonë poshtë dhe nuk fluturon në qiell?" Diskutim mbi gravitetin.\n` +
        `2. Realizimi i Kuptimit (25 min): Eksperimenti me makinën lodër në 3 sipërfaqe (tavolinë e lëmuar, letër xhami, tapet). Matja e distancës së përshkuar. Përkufizimi i fërkimit dhe paraqitja e forcave me shigjeta.\n` +
        `3. Reflektimi (10 min): Pyetja përmbyllëse: "Çfarë do të ndodhte sikur të zhdukej fërkimi për një ditë?" dhe vetëvlerësimi.`,
      assessment: `Vlerësim formativ i pjesëmarrjes në eksperiment, saktësisë së matjeve dhe arsyetimit fizik.`,
      homework: `Përshkruani në fletore 3 raste ku përdorni fërkimin gjatë ditës suaj.`,
      reflection: `Eksperimenti me rrafshin e pjerrët dhe sipërfaqet e ndryshme bëri që koncepti i fërkimit të fiksohet pa asnjë paqartësi.`
    };
  }

  // ==========================================================================
  // 4. HISTORY, GEOGRAPHY & SOCIETY (Histori, Gjeografi, Edukatë Qytetare)
  // ==========================================================================
  if (subjLower.includes('histori') || subjLower.includes('gjeografi') || subjLower.includes('shoqëri') || subjLower.includes('qytetari') || unitLower.includes('hart') || unitLower.includes('prizren') || unitLower.includes('ilir') || unitLower.includes('relief')) {
    const isHistory = subjLower.includes('histori') || unitLower.includes('prizren') || unitLower.includes('ilir') || unitLower.includes('skenderbeu');
    const domainName = isHistory ? 'Histori' : 'Gjeografi';

    return {
      topic: `${domainName} — ${unitRaw}: Rëndësia, burimet dhe interpretimi shkencor (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja analizon ngjarjet, dukuritë dhe proceset e lidhura me "${unitRaw}", duke zhvilluar mendim kritik, vetëdije qytetare dhe orientim hapësinor e kohor për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Lidh shkaqet me pasojat historike/gjeografike dhe interpreton burimet e informacionit.`,
        `Kompetenca qytetare: Vlerëson trashëgiminë historike, kulturore dhe mjedisore të vendit dhe botës.`
      ],
      fieldOutcomes: [
        `Përdor hartën, boshtin kohor dhe burimet e shkruara për të vendosur ngjarjet në kontekstin e tyre real.`,
        `Argumenton me fakte rëndësinë e vendimmarrjeve historike ose veçorive gjeografike.`
      ],
      keywords: `${unitRaw}, burime historike/gjeografike, bosht kohor, hartë, shkak dhe pasojë, trashëgimi, komunitet`,
      lessonOutcomes: [
        `Përcakton kohën dhe hapësirën ku u zhvillua ngjarja apo shtrihet dukuria gjeografike.`,
        `Analizon shkaqet kryesore dhe faktorët vendimtarë që ndikuan në këtë proces.`,
        `Interpreton dokumente, harta apo dëshmi vizuale historike me sy kritik.`,
        `Shpjegon ndikimin e kësaj teme në shoqërinë e sotme dhe identitetin tonë.`
      ],
      successCriteria: [
        `Unë mund të tregoj në hartë ose në boshtin kohor vendndodhjen e saktë të temës.`,
        `Unë mund të rendis të paktën dy shkaqe dhe dy pasoja kryesore.`,
        `Unë mund të shpjegoj rëndësinë që ka kjo njohuri për ditët e sotme.`
      ],
      resources: `Teksti mësimor, harta historike/gjeografike në mur, dokumente e fotografi arkivore, fletore pune.`,
      crossCurricular: `Gjuhë shqipe (krijimi i tekstit argumentues), TIK (harta digjitale dhe arkivat online).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Paraqitja e një fotografie arkivore ose pyetje nxitëse lidhur me temën. Çfarë shohim dhe çfarë dimë?\n` +
        `2. Realizimi i Kuptimit (25 min): Puna me hartën dhe burimet historike. Analiza në grupe: Grupi i Shkaqeve, Grupi i Rrjedhës, Grupi i Pasojave. Prezantimi i gjetjeve.\n` +
        `3. Reflektimi (10 min): Diskutimi në rreth: "Cili është mësimi më i madh që nxjerrim sot?" dhe vetëvlerësimi.`,
      assessment: `Vlerësim formativ i leximit të hartës, arsyetimit historik/gjeografik dhe bashkëpunimit në grupe.`,
      homework: `Shkruani një përmbledhje të shkurtër me 5 fjali mbi rëndësinë e kësaj ngjarjeje/dukure në fletore.`,
      reflection: `Përdorimi i fotografive historike dhe hartave të mëdha ngjalli kureshtje dhe diskutim shumë të frytshëm.`
    };
  }

  // ==========================================================================
  // 5. INFORMATICS & TECHNOLOGY (TIK / Teknologji)
  // ==========================================================================
  if (subjLower.includes('tik') || subjLower.includes('informatik') || unitLower.includes('kompjuter') || unitLower.includes('kodim') || unitLower.includes('scratch') || unitLower.includes('algoritëm')) {
    return {
      topic: `TIK — ${unitRaw}: Hapat llogaritës, zbatimi praktik dhe siguria digjitale (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja përvetëson konceptet e logjikës kompjuterike dhe algoritmeve, përdor mjetet digjitale në mënyrë të sigurt dhe zgjidh detyra praktike për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e të menduarit: Zbërthen një problem kompleks në hapa të vegjël të njëpasnjëshëm (mendimi kompjuterik).`,
        `Kompetenca digjitale: Përdor pajisjet teknologjike dhe programet edukative me efikasitet dhe etikë.`
      ],
      fieldOutcomes: [
        `Harton dhe zbaton algoritme lineare dhe me degëzime për zgjidhjen e situatave të thjeshta.`,
        `Zbaton rregullat e sigurisë në internet dhe mbrojtjes së privatësisë digjitale.`
      ],
      keywords: `algoritëm, sekuencë hapash, kompjuter, input/output, programim vizual, debogim, siguri digjitale`,
      lessonOutcomes: [
        `Përkufizon se çfarë është sekuenca e hapave dhe si e kupton kompjuteri një udhëzim.`,
        `Harton një algoritëm hap pas hapi për një veprim të përditshëm (p.sh. përgatitja e çajit apo ecja e robotit).`,
        `Zbulon dhe rregullon gabimet (bugs) në një sekuencë të pasaktë komandash.`,
        `Demonstron zbatimin e programit në kompjuter ose në fletë pune llogaritëse.`
      ],
      successCriteria: [
        `Unë mund të rendis në rregull logjik të paktën 5 hapa të një algoritmi.`,
        `Unë mund të gjej ku ka gabuar sekuenca dhe ta korrigjoj atë.`,
        `Unë mund të shpjegoj pse kompjuteri kërkon udhëzime krejtësisht të sakta.`
      ],
      resources: `Laboratori i TIK / kompjuterët, softueri edukativ (Scratch/Blockly), kartela komandash vizuale, fletore pune.`,
      crossCurricular: `Matematikë (logjika dhe koordinatat), Gjuhë shqipe (saktësia e fjalive urdhërore).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Loja "Mësuesi si robot": Nxënësit i japin komanda mësuesit për të marrë një shkumës. Nëse komanda nuk është e saktë, roboti ngec!\n` +
        `2. Realizimi i Kuptimit (25 min): Shpjegimi i algoritmit. Ndërtimi i skemës me blloqe komandash. Punë në çifte para kompjuterit ose me kartela sekuencash.\n` +
        `3. Reflektimi (10 min): Testimi i programeve të njëri-tjetrit dhe korrigjimi i gabimeve (debugging).`,
      assessment: `Vlerësim formativ i saktësisë së sekuencës së krijuar, gjetjes së gabimeve dhe bashkëpunimit në kompjuter.`,
      homework: `Shkruani në fletore algoritmin me 6 hapa të mënyrës si përgatitni çantën e shkollës.`,
      reflection: `Loja me robotin e gjallë i bëri nxënësit të kuptonin menjëherë nevojën për komanda të qarta dhe të sakta.`
    };
  }

  // ==========================================================================
  // 6. ARTS & PHYSICAL EDUCATION (Art Pamor, Muzikë, Edukatë Fizike)
  // ==========================================================================
  if (subjLower.includes('art') || subjLower.includes('muzik') || subjLower.includes('fizik') || subjLower.includes('sport')) {
    return {
      topic: `${subjRaw} — ${unitRaw}: Shprehja krijuese, teknika dhe bashkëpunimi (Ora ${pNum})`,
      topicLearningOutcome: `Nxënësi/ja zhvillon ndjeshmërinë estetike, zotëron teknikat praktike dhe shpreh përjetimet individuale përmes veprimtarive konkrete për klasën ${classLabel || gr}.`,
      competencyOutcomes: [
        `Kompetenca e komunikimit dhe të shprehurit: Komunikon ide dhe emocione përmes gjuhës artistike ose lëvizjes trupore.`,
        `Kompetenca personale: Zhvillon disiplinën vetjake, harmoninë dhe respektin për punën në grup.`
      ],
      fieldOutcomes: [
        `Përdor teknikat dhe mjetet përkatëse artistike/sportive me siguri dhe kreativitet.`,
        `Vlerëson dhe analizon punimet vetjake dhe të bashkëmoshatarëve me kulturë komunikimi.`
      ],
      keywords: `${unitRaw}, teknikë, ritëm, harmoni, kompozim, koordinim, krijimtari, bashkëpunim`,
      lessonOutcomes: [
        `Zbaton rregullat dhe elementet teknike të orës së mësimit.`,
        `Krijon një punim/performancë origjinale duke shprehur idetë vetjake.`,
        `Bashkëpunon në harmoni me shokët e klasës duke respektuar hapësirën e përbashkët.`,
        `Përshkruan me fjalë të thjeshta emocionet që përcjell krijimi i realizuar.`
      ],
      successCriteria: [
        `Unë mund të zbatoj saktë udhëzimet teknike të demonstrimit të mësuesit.`,
        `Unë mund të përfundoj punimin tim brenda kohës së caktuar.`,
        `Unë mund të shpreh një mendim inkurajues për punën e shokut tim.`
      ],
      resources: `Materialet përkatëse didaktike (ngjyra, fletë vizatimi / instrumente muzikore / mjete sportive), burime audio-vizuale.`,
      crossCurricular: `Gjuhë shqipe (pasurimi i fjalorit përshkrues), Shoqëri dhe mjedis (kultivimi i kulturës estetike dhe shëndetësore).`,
      methodology: `Struktura EVR — Ora ${pNum}:\n\n` +
        `1. Evokimi (10 min): Demonstrim nxitës audio-vizual ose nxehje dinamike.\n` +
        `2. Realizimi i Kuptimit (25 min): Shpjegimi i teknikës dhe demonstrimi i hapave. Puna krijuese/praktike e nxënësve me mbikëqyrje të drejtpërdrejtë.\n` +
        `3. Reflektimi (10 min): Ekspozita e punimeve ose vlerësimi i lojës, me komente konstruktive pozitive.`,
      assessment: `Vlerësim formativ i përpjekjes krijuese, respektimit të rregullave dhe origjinalitetit.`,
      homework: `Vëzhgoni një shembull të kësaj fushe në mjedisin e shtëpisë dhe sillni përshtypjet tuaja herën tjetër.`,
      reflection: `Nxënësit patën liri të lartë shprehëse dhe treguan kënaqësi të veçantë gjatë realizimit praktik.`
    };
  }

  // ==========================================================================
  // 7. HIGH-LEVEL DYNAMIC SEMANTIC GENERATOR (For Any Other Custom Topic)
  // Ensures 100% natural, deep, pedagogical Albanian/English with ZERO placeholder quotes!
  // ==========================================================================
  let phaseTitle = '';
  let outcome1 = '';
  let outcome2 = '';
  let outcome3 = '';
  let outcome4 = '';
  let criterion1 = '';
  let criterion2 = '';
  let criterion3 = '';

  if (pNum === 1) {
    phaseTitle = 'Hyrje, zbulim i koncepteve themelore dhe rregullat bazë';
    outcome1 = `Dallon dhe emërton konceptet thelbësore dhe terminologjinë kryesore të temës përmes vëzhgimit të modeleve konkrete.`;
    outcome2 = `Përshkruan parimin bazë dhe marrëdhëniet shkak-pasojë që rregullojnë këtë njësi mësimore në lëndën ${subjRaw}.`;
    outcome3 = `Zgjidh ushtrimet dhe shembujt e parë fillestarë të drejtuar nga mësimdhënësi/ja hap pas hapi.`;
    outcome4 = `Lidh konceptin e ri mësimor me njohuritë paraprake dhe situata intuitive nga përvoja e përditshme.`;
    criterion1 = `Unë mund të shpjegoj rregullën themelore dhe konceptet e para të mësuara sot.`;
    criterion2 = `Unë mund të zgjidh me saktësi shembujt bazë të punuar së bashku në tabelë.`;
    criterion3 = `Unë mund të identifikoj kuptimin e fjalëve dhe termave të rinj të kësaj ore.`;
  } else if (pNum === 2) {
    phaseTitle = 'Përforcim njohurish, ushtrime të larmishme praktike dhe raste sfiduese';
    outcome1 = `Zbaton me saktësi dhe shpejtësi procedurat dhe rregullat e përvetësuara në ushtrime me shkallë të ndryshme vështirësie.`;
    outcome2 = `Krahason qasje dhe mënyra alternative të zgjidhjes duke verifikuar saktësinë e hapave të ndërmarrë.`;
    outcome3 = `Zbulon dhe korrigjon pasaktësitë e zakonshme gjatë zbatimit të njohurive në punën e pavarur.`;
    outcome4 = `Bashkëpunon në mënyrë konstruktive me shokun e bankës për zgjidhjen e detyrave të përbashkëta.`;
    criterion1 = `Unë mund të zbatoj rregullën pa ndihmën e mësuesit në ushtrime të reja.`;
    criterion2 = `Unë mund të dalloj dhe korrigjoj gabimet në shembujt e trajtuar.`;
    criterion3 = `Unë mund të bashkëpunoj me shokët për të përfunduar me sukses fletën e punës.`;
  } else {
    phaseTitle = 'Zbatim në jetën reale, zgjidhje problemash kontekstuale dhe sintetizim';
    outcome1 = `Zbaton njohuritë e njësisë mësimore në situata problemore nga jeta e përditshme dhe fusha të ndërlidhura.`;
    outcome2 = `Modelon shembuj vetjakë dhe argumenton zgjedhjen e metodës para bashkëmoshatarëve.`;
    outcome3 = `Gjykon me mendim kritik rëndësinë praktike të kësaj njohurie për të ardhmen dhe profesionet.`;
    outcome4 = `Sintetizon përfundimet kryesore dhe prezanton qartë idetë e tij/saj para klasës.`;
    criterion1 = `Unë mund të zgjidh një problemë të jetës reale duke përdorur njohuritë e kësaj teme.`;
    criterion2 = `Unë mund të arsyetoj dhe mbroj mendimin tim gjatë diskutimit në klasë.`;
    criterion3 = `Unë mund të lidh këtë temë me zbatime konkrete jashtë shkollës.`;
  }

  return {
    topic: `${subjRaw} — ${unitRaw} (${phaseTitle}, Ora ${pNum})`,
    topicLearningOutcome: `Nxënësi/ja thellon njohuritë dhe shkathtësitë praktike për temën "${unitRaw}", duke zhvilluar arsyetimin logjik, të menduarit kritik dhe kompetencat zbatuese të përshtatshme për klasën ${classLabel || gr}.`,
    competencyOutcomes: [
      `Kompetenca e komunikimit: Përdor terminologjinë përkatëse shkencore e lëndore për të artikuluar qartë idetë rreth temës.`,
      `Kompetenca e të menduarit: Analizon dhe zbërthen informacionin e ri duke e zbatuar në shembuj të larmishëm të orës ${pNum}.`,
      `Kompetenca e të nxënit: Menaxhon kohën e punës në mënyrë të pavarur dhe vetëvlerëson nivelin e arritjes së kritereve.`,
      `Kompetenca personale: Bashkëpunon me tolerancë dhe frymë pozitive gjatë aktiviteteve në grup.`
    ],
    fieldOutcomes: [
      `Zbaton konceptet thelbësore të fushës "${curricularArea || 'Lëndore'}" në veprimtari mësimore të përshtatshme për ${stage}.`,
      `Demonstron zotërim të shprehive procedurale përmes mjeteve didaktike dhe burimeve të përzgjedhura.`
    ],
    keywords: `${unitRaw}, konceptet kyçe, procedura, arsyetim, krahasim, zbatim praktik, shkathtësi, Ora ${pNum}`,
    lessonOutcomes: [outcome1, outcome2, outcome3, outcome4],
    successCriteria: [criterion1, criterion2, criterion3],
    resources: `Teksti mësimor i klasës ${classLabel || gr}, fletore pune, tabela e shënimeve, fletë pune me ushtrime të diferencuara, pajisje digjitale/projektor.`,
    crossCurricular: `Gjuhët dhe komunikimi (përvetësimi i fjalorit të saktë), Matematika (struktura logjike e të menduarit), TIK (burimet digjitale).`,
    methodology: `Struktura EVR — Ora ${pNum} (${phaseTitle}):\n\n` +
      `1. Evokimi (10 min):\n` +
      `• Pyetje nxitëse dhe stuhi mendimesh për të aktivizuar njohuritë paraprake të nxënësve.\n` +
      `• Diskutim i shkurtër në çifte për të lidhur temën me përvojat vetjake.\n\n` +
      `2. Realizimi i Kuptimit (25 min):\n` +
      `• Prezantimi interaktiv i materialit të ri duke përdorur demonstrime dhe shembuj vizualë.\n` +
      `• Punë e drejtuar me klasën me modelimin e 3 shembujve nga mësimdhënësi/ja.\n` +
      `• Punë në çifte dhe punë e pavarur me fletët e punës të përgatitura për Orën ${pNum}.\n` +
      `• Mbështetje e diferencuar për nxënësit që kërkojnë ndihmë shtesë.\n\n` +
      `3. Reflektimi (10 min):\n` +
      `• Përmbledhja e zbulimeve kryesore përmes teknikës "3-2-1" (3 gjëra që mësuam, 2 pyetje, 1 shembull).\n` +
      `• Vetëvlerësimi i nxënësve kundrejt kritereve të suksesit.`,
    assessment: `• Vlerësim formativ përmes vëzhgimit të drejtpërdrejtë dhe pyetjeve diagnostikuese.\n• Kontrolli i fletëve të punës dhe zgjidhjeve individuale.\n• Vlerësimi i bashkëpunimit gjatë punës në dyshe.`,
    homework: `Zgjidhja e ushtrimeve përkatëse në fletoren e punës dhe formulimi i një shembulli origjinal për orën pasuese.`,
    reflection: `Objektivat e orës ${pNum} u arritën me sukses. Nxënësit treguan interesim të lartë gjatë fazës interaktive.`
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
  const grade = parsed?.grade ?? (classLabel ? parseInt(classLabel.replace(/\D/g, ''), 10) || null : null);
  const stage = curriculumStage || (classLabel ? stageForClass(classLabel) : 'Shkalla III');
  const area = curricularArea || (subject ? getSubjectArea(subject, { classLabel }) : 'Kurrikulare');
  const pInfo = parsePeriod(period);

  const storageKey = typeof localStorage !== 'undefined' ? localStorage.getItem('lumi-gemini-api-key') : '';
  const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY ? import.meta.env.VITE_GEMINI_API_KEY : '';
  const apiKey = clean(userApiKey || storageKey || envKey || '');

  const isSq = language === 'sq';

  // 1. Try Google Gemini API if a key is present
  if (apiKey) {
    const prompt = `You are an elite master pedagogue and curriculum specialist adhering strictly to the Kosovo & Albania Ministry of Education (MASHTI) competency-based curriculum framework.

CRITICAL PEDAGOGICAL CONTEXT:
- Subject (Lënda): ${subject}
- Class/Grade (Klasa): ${classLabel} (Grade ${grade ?? 'Standard'})
- Curricular Area (Fusha Kurrikulare): ${area}
- Curriculum Stage (Shkalla): ${stage}
- Lesson Unit (Njësia Mësimore): ${lessonUnit}
- Lesson Period (Ora Mësimore): ${pInfo.number} (${pInfo.stage})
- Duration: ${duration || 45} minutes
- Language: Output strictly in ${isSq ? 'Albanian (Shqip)' : 'English'}.

CRITICAL INSTRUCTIONS ON "ORA MËSIMORE" & HIGH-VALUE CONTENT:
1. TAKE "ORA MËSIMORE" DEEPLY INTO ACCOUNT:
   - If Ora 1: FIRST time encountering this unit! Focus on discovery of concepts, visual representations (number line, manipulatives, diagrams), intuitive understanding, and fundamental rules.
   - If Ora 2: Focus on structured drill & practice, varied examples, handling edge cases and common mistakes, and collaborative pair work.
   - If Ora 3: Focus on real-world contextual application, word problems, shopping/budgeting/measurement cases, and synthesis.
   - If Ora 4+: Focus on consolidation, review, formative quizzes, and differentiated remediation/extension.
2. STRICTLY FORBIDDEN - ZERO GENERIC BOILERPLATE:
   - NEVER write generic placeholder phrases like:
     "Përkufizon dhe shpjegon konceptin kryesor të ${lessonUnit} me fjalët e veta"
     "Unë mund të shpjegoj qartë se çfarë është ${lessonUnit}"
     "Zbaton rregullat dhe konceptet në shembuj dhe ushtrime konkrete"
3. MANDATORY PEDAGOGICAL SPECIFICITY:
   - Write authentic, concrete mathematical rules, numbers, place values (if math), grammatical terms and example words (if language), biological/physical systems and scientific laws (if science), historical events and causes (if history).
   - Outcomes and success criteria MUST use Bloom's taxonomy action verbs (Dallon, Gjen, Zbaton, Krahason, Korrigjon, Arsyeton) with REAL examples.

Return ONLY a valid JSON object matching this exact schema:
{
  "topic": "Specific Topic title mentioning Ora ${pInfo.number} and the pedagogical focus",
  "topicLearningOutcome": "Rich paragraph describing overall conceptual competency for this grade",
  "competencyOutcomes": [
    "Kompetenca e të menduarit: specific outcome...",
    "Kompetenca e komunikimit: specific outcome...",
    "Kompetenca e të nxënit: specific outcome...",
    "Kompetenca qytetare/personale: specific outcome..."
  ],
  "fieldOutcomes": [
    "Specific field outcome 1...",
    "Specific field outcome 2..."
  ],
  "keywords": "Specific keywords separated by comma",
  "lessonOutcomes": [
    "Specific concrete outcome 1 for this exact hour...",
    "Specific concrete outcome 2...",
    "Specific concrete outcome 3...",
    "Specific concrete outcome 4..."
  ],
  "successCriteria": [
    "Unë mund të...",
    "Unë mund të...",
    "Unë mund të...",
    "Unë mund të..."
  ],
  "resources": "Specific concrete materials, textbooks, visual aids, digital tools",
  "crossCurricular": "Specific links with other subjects",
  "methodology": "Exhaustive 3-stage EVR breakdown (Evokim 10 min, Realizim i Kuptimit 25 min, Reflektim 10 min) with detailed classroom activities for Ora ${pInfo.number}",
  "assessment": "Specific formative assessment techniques for this lesson",
  "homework": "Specific concrete homework exercises",
  "reflection": "Thoughtful teacher reflection on anticipated student comprehension"
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
