import type { MuscleKey } from './muscles';
import type { Exercise, ExerciseTechnique, Pattern } from './types';

const t = (setup: string[], steps: string[], mistakes: string[], feel: MuscleKey[], tip?: string): ExerciseTechnique => ({ setup, steps, mistakes, feel, tip });

/** Technique cues for every built-in exercise (SEED_EXERCISES), keyed by id. */
export const TECHNIQUE: Record<string, ExerciseTechnique> = {
  // ---------- Pecho ----------
  bench: t(
    ['Tumbado con los ojos bajo la barra y los pies firmes en el suelo.', 'Junta y baja las escápulas, con un arco lumbar natural.', 'Agarre algo más ancho que los hombros, muñecas rectas sobre los antebrazos.'],
    ['Saca la barra y colócala sobre los hombros.', 'Baja en 2–3 s hasta tocar la parte baja del pecho, codos a unos 45–70° del torso.', 'Empuja hacia arriba y ligeramente hacia la cara, sin despegar los glúteos.'],
    ['Codos abiertos a 90° → cargan el hombro; ciérralos hacia 45–70°.', 'Rebotar en el pecho → pausa breve abajo y empuja con control.', 'Glúteos levantados → empuja con las piernas sin despegar la cadera.'],
    ['pecho', 'tri'],
    'Si entrenas pesado, usa topes de seguridad o alguien que te ayude.',
  ),
  incline_db: t(
    ['Banco a 30°, mancuernas apoyadas en los muslos.', 'Al tumbarte, súbelas con las rodillas y junta las escápulas.'],
    ['Baja en 2–3 s hasta que las mancuernas queden a la altura del pecho alto.', 'Codos ligeramente por debajo de los hombros, antebrazos verticales.', 'Empuja hacia arriba juntándolas un poco sin chocarlas.'],
    ['Banco muy inclinado (45°+) → trabaja más hombro; quédate en 30°.', 'Bajar poco → busca estirar el pecho sin dolor de hombro.'],
    ['pecho', 'delt'],
  ),
  db_bench: t(
    ['Tumbado en banco plano, escápulas juntas y abajo, pies firmes.', 'Mancuernas a la altura del pecho, palmas hacia los pies.'],
    ['Baja en 2–3 s abriendo el pecho, codos a 45–70°.', 'Empuja hacia arriba en un ligero arco hasta casi juntarlas.'],
    ['Perder la posición de escápulas → mantenlas pegadas al banco todo el rato.', 'Muñecas dobladas hacia atrás → nudillos al techo, muñeca neutra.'],
    ['pecho', 'tri'],
    'Al terminar, apoya las mancuernas en los muslos y siéntate; no las sueltes a los lados.',
  ),
  pushup: t(
    ['Manos algo más anchas que los hombros, cuerpo en línea de cabeza a talones.', 'Glúteos y abdomen apretados.'],
    ['Baja en 2 s hasta que el pecho casi toque el suelo, codos a unos 45°.', 'Empuja el suelo hasta extender los brazos y separa un poco las escápulas arriba.'],
    ['Cadera caída → aprieta glúteos y abdomen.', 'Codos en T → llévalos hacia las costillas.', 'Medio recorrido → baja hasta un puño del suelo.'],
    ['pecho', 'tri'],
  ),
  pushup_w: t(
    ['Lastre en mochila o chaleco, bien ajustado y centrado en la espalda.', 'Misma posición que la flexión: cuerpo rígido en línea.'],
    ['Baja en 2–3 s con los codos a 45°.', 'Empuja fuerte sin perder la línea del cuerpo.'],
    ['El peso se desplaza y arquea la zona lumbar → ajústalo más alto y aprieta el abdomen.', 'Recortar recorrido al cansarte → para la serie cuando no llegues abajo.'],
    ['pecho', 'tri'],
  ),
  archer_pu: t(
    ['Elige tu nivel: inclinadas, arquero asistida, arquero, una mano inclinada o una mano.', 'Manos muy separadas (arquero) o una sola mano bajo el pecho.'],
    ['Lleva el peso hacia el brazo que trabaja mientras el otro queda casi estirado.', 'Baja con control y empuja sin girar la cadera.'],
    ['Rotar el torso → piernas más abiertas y abdomen firme.', 'Usar mucho el brazo de apoyo → apóyalo solo con los dedos.'],
    ['pecho', 'tri', 'delt'],
    'Sube de nivel cuando hagas el rango alto de reps con buena forma.',
  ),
  cable_fly: t(
    ['Poleas a la altura de los hombros, un paso adelante y una pierna adelantada.', 'Codos ligeramente flexionados y fijos.'],
    ['Abre los brazos en arco hasta notar estiramiento en el pecho.', 'Cierra como si abrazaras un árbol hasta juntar las manos delante.'],
    ['Convertirlo en un press doblando los codos → mantén el ángulo fijo.', 'Echarse hacia delante para mover más peso → menos carga y más control.'],
    ['pecho'],
  ),
  pec_deck: t(
    ['Asiento con las asas a la altura del pecho, espalda pegada al respaldo.', 'Codos ligeramente flexionados.'],
    ['Cierra los brazos hasta juntar las asas y aprieta 1 s.', 'Abre despacio hasta un estiramiento cómodo.'],
    ['Hombros hacia delante → saca pecho y mantén las escápulas atrás.', 'Abrir demasiado → para donde notes el pecho, no el hombro.'],
    ['pecho'],
  ),

  // ---------- Espalda ----------
  row: t(
    ['Pies a la anchura de la cadera, rodillas algo flexionadas.', 'Inclina el torso a unos 45° con la espalda neutra y la barra colgando bajo los hombros.'],
    ['Tira de la barra hacia el ombligo llevando los codos atrás.', 'Junta las escápulas arriba 1 s y baja en 2 s.'],
    ['Erguirse en cada rep → mantén el ángulo del torso.', 'Espalda redondeada → menos peso y pecho fuera.', 'Tirar con los bíceps → piensa en llevar los codos atrás.'],
    ['dors', 'trap', 'deltp'],
  ),
  pull: t(
    ['Lastre en cinturón, agarre prono algo más ancho que los hombros.', 'Cuelga con los brazos estirados y los hombros activos (sin encogerlos).'],
    ['Baja las escápulas y tira llevando el pecho hacia la barra.', 'Sube hasta pasar la barbilla y baja en 2–3 s hasta estirar del todo.'],
    ['Balancearse o patear → piernas juntas y abdomen firme.', 'Medio recorrido → extiende los brazos abajo en cada rep.', 'Barbilla estirada para llegar → si no pasa limpia, la rep no cuenta.'],
    ['dors', 'bic'],
  ),
  pullup_bw: t(
    ['Agarre prono algo más ancho que los hombros.', 'Cuelga con brazos estirados, piernas juntas y abdomen firme.'],
    ['Inicia bajando las escápulas y tira con los codos hacia las costillas.', 'Sube hasta pasar la barbilla y baja en 2–3 s.'],
    ['Balanceo → aprieta glúteos y piernas.', 'Encoger los hombros arriba → mantén el cuello largo.'],
    ['dors', 'bic'],
    'Si no llegas a 5 reps, usa banda o haz solo la bajada lenta.',
  ),
  chinup: t(
    ['Agarre supino (palmas hacia ti) a la anchura de los hombros.', 'Cuelga con los hombros activos.'],
    ['Tira llevando los codos hacia abajo y delante hasta pasar la barbilla.', 'Baja en 2–3 s hasta estirar los brazos.'],
    ['Solo medio recorrido → extiende abajo.', 'Muñecas dobladas → agarre firme con la muñeca neutra.'],
    ['dors', 'bic'],
  ),
  muscleup: t(
    ['Agarre falso (muñeca por encima de la barra) algo más estrecho que los hombros.', 'Domina antes 10 dominadas al pecho y 10 fondos en barra.'],
    ['Tira explosivo llevando la barra hacia las caderas, no hacia la barbilla.', 'Pasa rápido el pecho por encima de la barra inclinándote hacia delante.', 'Empuja hasta bloquear los brazos y baja controlado.'],
    ['Tirar vertical → la barra debe ir hacia la cadera, en arco.', 'Un brazo antes que el otro → practica la transición con banda.'],
    ['dors', 'tri', 'pecho'],
    'Habilidad avanzada: calienta bien hombros y codos.',
  ),
  latpull: t(
    ['Muslos bien sujetos bajo el rodillo.', 'Agarre algo más ancho que los hombros y torso ligeramente inclinado atrás.'],
    ['Baja las escápulas y tira la barra hacia la parte alta del pecho.', 'Codos hacia abajo y atrás; sube en 2 s hasta estirar.'],
    ['Echarse muy atrás → se convierte en remo; limita la inclinación.', 'Llevar la barra detrás de la nuca → siempre por delante.'],
    ['dors', 'bic'],
  ),
  db_row: t(
    ['Mano y rodilla del mismo lado en el banco, espalda plana y paralela al suelo.', 'Mancuerna colgando bajo el hombro.'],
    ['Tira llevando el codo hacia la cadera, rozando el costado.', 'Pausa arriba y baja en 2 s estirando el dorsal.'],
    ['Rotar el torso para subir → menos peso y hombros paralelos al suelo.', 'Codo abierto → pégalo al cuerpo para el dorsal.'],
    ['dors', 'deltp'],
  ),
  cable_row: t(
    ['Sentado, pies en el soporte y rodillas algo flexionadas.', 'Torso erguido y pecho fuera.'],
    ['Tira del agarre hacia el abdomen llevando los codos atrás.', 'Junta escápulas 1 s y vuelve dejando que se separen, sin mover el torso.'],
    ['Balancear el torso adelante y atrás → muévete solo con los brazos y escápulas.', 'Encoger hombros → mantenlos lejos de las orejas.'],
    ['dors', 'trap'],
  ),
  inv_row: t(
    ['Barra o anillas a la altura de la cadera; cuélgate debajo con el cuerpo recto y los talones en el suelo.', 'Cuanto más horizontal, más difícil.'],
    ['Tira llevando el pecho a la barra y los codos atrás.', 'Baja en 2 s hasta estirar los brazos.'],
    ['Cadera caída → glúteos y abdomen firmes.', 'Llevar la barbilla en vez del pecho → el pecho toca la barra.'],
    ['dors', 'trap', 'deltp'],
  ),
  pullover: t(
    ['Frente a la polea alta con cuerda o barra recta, un paso atrás.', 'Inclínate ligeramente con brazos casi estirados.'],
    ['Lleva la barra en arco desde arriba hasta los muslos.', 'Vuelve despacio hasta notar el estiramiento del dorsal.'],
    ['Doblar mucho los codos → mantén el ángulo fijo.', 'Mover el torso → solo se mueven los hombros.'],
    ['dors'],
  ),
  shrug: t(
    ['De pie, mancuernas a los lados, brazos estirados.'],
    ['Sube los hombros hacia las orejas en línea recta.', 'Aguanta 1 s arriba y baja despacio.'],
    ['Girar los hombros en círculo → solo arriba y abajo.', 'Doblar los codos → los brazos son ganchos.'],
    ['trap'],
  ),
  backext: t(
    ['Caderas apoyadas justo en el borde del aparato, talones sujetos.', 'Lastre abrazado al pecho.'],
    ['Baja doblando la cadera con la espalda neutra.', 'Sube hasta que el cuerpo quede en línea, sin pasarte.'],
    ['Hiperextender arriba → para en línea recta.', 'Redondear la espalda abajo → controla el recorrido.'],
    ['lumb', 'glut'],
  ),

  // ---------- Hombros ----------
  ohp: t(
    ['De pie, barra sobre los hombros, agarre algo más ancho que ellos.', 'Glúteos y abdomen apretados, codos un poco por delante de la barra.'],
    ['Empuja la barra en vertical apartando la cabeza hacia atrás.', 'Cuando pase la frente, mete la cabeza "por la ventana" y bloquea arriba.', 'Baja en 2 s hasta la clavícula.'],
    ['Arquear la zona lumbar → aprieta glúteos y abdomen.', 'Barra hacia delante → debe subir pegada a la cara.'],
    ['delt', 'tri'],
  ),
  db_ohp: t(
    ['Sentado con respaldo vertical o de pie, mancuernas a la altura de los hombros.', 'Palmas hacia delante o semineutras.'],
    ['Empuja hacia arriba hasta casi juntarlas.', 'Baja en 2 s hasta la altura de las orejas.'],
    ['Arquear la espalda → abdomen firme y glúteos apretados.', 'Bajar muy poco → llega al menos a la oreja.'],
    ['delt', 'tri'],
  ),
  landmine: t(
    ['Extremo de la barra a la altura del hombro, de pie o de rodillas.', 'Torso ligeramente inclinado hacia la barra.'],
    ['Empuja hacia arriba y adelante hasta extender el brazo.', 'Baja controlando hasta el hombro.'],
    ['Rotar el torso → abdomen y glúteos firmes.', 'Encoger el hombro → aleja el hombro de la oreja arriba.'],
    ['delt', 'pecho'],
    'Buena opción si el press por encima de la cabeza te molesta en el hombro.',
  ),
  hspu: t(
    ['Elige tu nivel: pike, pike con pies elevados, pino asistido en pared, en pared o libre.', 'Manos a la anchura de los hombros, dedos abiertos.'],
    ['Baja la cabeza formando un triángulo con las manos.', 'Empuja hasta extender los brazos llevando el peso sobre las manos.'],
    ['Codos muy abiertos → apúntalos hacia atrás a unos 45°.', 'Cadera baja en el pike → súbela para cargar más el hombro.'],
    ['delt', 'tri'],
    'En pared, pon un cojín bajo la cabeza hasta dominar el recorrido.',
  ),
  lat: t(
    ['De pie, mancuernas a los lados, leve inclinación adelante.', 'Codos ligeramente flexionados.'],
    ['Sube los brazos hacia los lados hasta la altura de los hombros, con los codos guiando.', 'Baja en 2–3 s sin dejar caer.'],
    ['Encoger el trapecio → piensa en alejar las manos hacia los lados.', 'Balancear el cuerpo → menos peso.'],
    ['delt'],
  ),
  cable_lat: t(
    ['Polea baja a un lado; cruza el cable por delante del cuerpo.', 'Sujétate con la otra mano.'],
    ['Abre el brazo hacia el lado hasta la altura del hombro.', 'Baja despacio manteniendo la tensión.'],
    ['Subir por encima del hombro → para a la altura del hombro.', 'Inclinarse para tirar → mantén el torso quieto.'],
    ['delt'],
  ),
  rear_fly: t(
    ['Inclinado con el pecho casi paralelo al suelo o apoyado en banco inclinado.', 'Mancuernas colgando, codos un poco flexionados.'],
    ['Abre los brazos hacia los lados llevando los codos atrás.', 'Pausa 1 s y baja despacio.'],
    ['Juntar escápulas al máximo → el trabajo es del hombro posterior; no las aprietes del todo.', 'Usar impulso → peso ligero, control total.'],
    ['deltp'],
  ),
  ytw: t(
    ['Boca abajo en banco a 30–45°, pecho apoyado, mancuernas muy ligeras.', 'Pulgares hacia arriba.'],
    ['Y: sube los brazos en diagonal por encima de la cabeza.', 'T: ábrelos en cruz a la altura de los hombros.', 'W: dobla codos y llévalos atrás juntando escápulas.'],
    ['Usar demasiado peso → con 2–4 kg basta.', 'Encoger los hombros → mantenlos abajo.'],
    ['deltp', 'trap'],
    'Ideal como calentamiento o prehabilitación de hombro.',
  ),
  facepull: t(
    ['Polea a la altura de la cara con cuerda, agarre con pulgares hacia ti.', 'Un paso atrás, brazos estirados.'],
    ['Tira hacia la cara separando la cuerda y llevando los codos altos y atrás.', 'Termina con las manos a los lados de las orejas, girando hacia fuera.'],
    ['Codos bajos → se convierte en remo; mantenlos a la altura de los hombros.', 'Echarse atrás → peso más ligero.'],
    ['deltp', 'trap'],
  ),

  // ---------- Brazos ----------
  curl: t(
    ['Banco a 45–60°, espalda apoyada, brazos colgando por detrás del torso.', 'Palmas hacia delante.'],
    ['Sube las mancuernas sin mover los codos.', 'Aprieta arriba y baja en 2–3 s hasta estirar del todo.'],
    ['Adelantar los codos → quedan fijos apuntando al suelo.', 'Recortar abajo → el estiramiento es la gracia del ejercicio.'],
    ['bic'],
  ),
  bb_curl: t(
    ['De pie, agarre supino a la anchura de los hombros.', 'Codos pegados al cuerpo.'],
    ['Sube la barra sin mover los codos.', 'Baja en 2 s hasta casi estirar.'],
    ['Balanceo con la espalda → menos peso, glúteos apretados.', 'Codos que avanzan → déjalos junto a las costillas.'],
    ['bic', 'ante'],
  ),
  hammer: t(
    ['De pie, mancuernas a los lados con palmas enfrentadas.'],
    ['Sube con los pulgares hacia arriba sin girar la muñeca.', 'Baja controlado.'],
    ['Balancear el cuerpo → codos fijos y peso que controles.', 'Cruzar la mancuerna por delante → sube en línea recta.'],
    ['bic', 'ante'],
  ),
  preacher: t(
    ['Axilas pegadas al borde del banco Scott, brazos apoyados.', 'Agarre supino.'],
    ['Sube sin despegar los tríceps del apoyo.', 'Baja en 3 s hasta casi estirar, sin bloquear.'],
    ['Soltar el peso abajo → controla la bajada, el codo es vulnerable estirado.', 'Levantar los codos → quedan apoyados.'],
    ['bic'],
  ),
  triext: t(
    ['De pie o sentado, mancuerna o cuerda sujeta detrás de la cabeza.', 'Codos apuntando al techo y cerca de la cabeza.'],
    ['Extiende los brazos hacia arriba sin mover los codos.', 'Baja despacio hasta notar el estiramiento.'],
    ['Abrir los codos → mantenlos cerrados.', 'Arquear la espalda → abdomen firme.'],
    ['tri'],
  ),
  skull: t(
    ['Tumbado en banco plano, barra EZ sobre el pecho con brazos estirados.', 'Inclina ligeramente los brazos hacia la cabeza.'],
    ['Dobla los codos y baja la barra hacia la frente o detrás de la cabeza.', 'Extiende sin mover los codos.'],
    ['Codos abiertos → apúntalos al techo.', 'Convertirlo en press → solo se mueve el codo.'],
    ['tri'],
  ),
  pushdown: t(
    ['Frente a la polea alta, codos pegados a los costados.', 'Torso ligeramente inclinado adelante.'],
    ['Empuja hacia abajo hasta extender del todo los codos.', 'Sube despacio hasta que los antebrazos pasen la horizontal.'],
    ['Mover los codos adelante y atrás → quedan pegados.', 'Echar el cuerpo encima → peso que muevas solo con los brazos.'],
    ['tri'],
  ),
  cgbench: t(
    ['Como el press banca, pero con agarre a la anchura de los hombros.', 'Escápulas juntas y pies firmes.'],
    ['Baja en 2 s a la parte baja del pecho con los codos pegados.', 'Empuja hasta bloquear los codos.'],
    ['Agarre demasiado estrecho → molesta en las muñecas; usa anchura de hombros.', 'Codos abiertos → pégalos al torso.'],
    ['tri', 'pecho'],
  ),
  wrist: t(
    ['Sentado, antebrazos sobre los muslos o un banco y muñecas por fuera.', 'Palmas hacia arriba.'],
    ['Deja rodar la barra hasta los dedos y ciérrala.', 'Sube la muñeca todo lo posible y baja despacio.'],
    ['Mover los antebrazos → quedan apoyados.', 'Recorrido corto → aprovecha todo el rango.'],
    ['ante'],
  ),
  farmer: t(
    ['Mancuernas o kettlebells pesadas a los lados.', 'Pecho fuera y hombros abajo.'],
    ['Camina con pasos cortos y rápidos, mirando al frente.', 'Mantén el agarre fuerte durante todo el tiempo.'],
    ['Encorvarse → hombros atrás y abdomen firme.', 'Inclinarse a un lado → reparte el peso igual.'],
    ['ante', 'trap'],
  ),

  // ---------- Piernas ----------
  squat: t(
    ['Barra apoyada en los trapecios, agarre firme y codos bajo la barra.', 'Pies a la anchura de los hombros, puntas algo abiertas.', 'Coge aire y aprieta el abdomen antes de bajar.'],
    ['Baja sentándote entre los talones con las rodillas en la línea de los pies.', 'Llega al menos a que la cadera quede a la altura de las rodillas.', 'Sube empujando el suelo con todo el pie y el pecho fuera.'],
    ['Rodillas hacia dentro → empújalas hacia fuera.', 'Talones que se levantan → reparte el peso en todo el pie.', 'Pecho que cae al subir → sube cadera y pecho a la vez.'],
    ['quad', 'glut'],
    'Usa topes o rack de seguridad cuando trabajes pesado.',
  ),
  goblet: t(
    ['Mancuerna o kettlebell sujeta en vertical contra el pecho.', 'Pies algo más anchos que los hombros.'],
    ['Baja con el torso erguido hasta que los codos rocen las rodillas.', 'Sube empujando con todo el pie.'],
    ['Inclinarse hacia delante → la pesa pegada al pecho.', 'Bajar poco → busca la profundidad completa.'],
    ['quad', 'glut'],
  ),
  bulg: t(
    ['Pie trasero sobre un banco, pie delantero a un paso largo.', 'Mancuernas a los lados.'],
    ['Baja en vertical hasta que la rodilla trasera casi toque el suelo.', 'Sube empujando con el talón delantero.'],
    ['Pie demasiado cerca del banco → aléjalo hasta que la rodilla delantera no pase mucho la punta.', 'Torso cayendo → pecho alto o ligera inclinación si buscas más glúteo.'],
    ['quad', 'glut'],
  ),
  legpress: t(
    ['Espalda y cadera pegadas al respaldo.', 'Pies a la anchura de los hombros en el centro de la plataforma.'],
    ['Baja hasta que las rodillas formen unos 90° o algo más, sin despegar la cadera.', 'Empuja con todo el pie sin bloquear las rodillas arriba.'],
    ['Cadera que se levanta del asiento → menos recorrido.', 'Bloquear las rodillas → deja una ligera flexión arriba.'],
    ['quad', 'glut'],
  ),
  lunge: t(
    ['De pie con mancuernas a los lados.'],
    ['Da un paso largo y baja hasta casi tocar el suelo con la rodilla trasera.', 'Empuja con la pierna delantera y avanza con la otra.'],
    ['Pasos cortos → la rodilla delantera sufre; alarga el paso.', 'Rodilla hacia dentro → alineada con el pie.'],
    ['quad', 'glut'],
  ),
  stepup: t(
    ['Cajón a la altura de la rodilla, mancuernas a los lados.', 'Pie entero sobre el cajón.'],
    ['Sube empujando con la pierna de arriba, sin impulsarte con la de abajo.', 'Baja controlando en 2 s.'],
    ['Impulsarse con el pie de abajo → apóyalo solo con la punta.', 'Rodilla hacia dentro → alineada con el pie.'],
    ['quad', 'glut'],
  ),
  pistol: t(
    ['Elige tu nivel: a caja, asistida, talón elevado, completa o lastrada.', 'De pie sobre una pierna, la otra estirada al frente.'],
    ['Baja despacio llevando los brazos al frente para equilibrar.', 'Sube empujando con todo el pie.'],
    ['Talón que se despega → usa un disco bajo el talón.', 'Caer al final → baja solo hasta donde controles.'],
    ['quad', 'glut'],
  ),
  legext: t(
    ['Respaldo ajustado para que la rodilla quede alineada con el eje de la máquina.', 'Rodillo sobre el tobillo.'],
    ['Extiende las piernas hasta casi bloquear y aprieta 1 s.', 'Baja en 2–3 s.'],
    ['Levantar la cadera del asiento → agárrate a las asas.', 'Soltar el peso → controla la bajada.'],
    ['quad'],
  ),
  legcurl: t(
    ['Tumbado boca abajo, rodillas justo fuera del banco y rodillo sobre los tobillos.'],
    ['Lleva los talones hacia los glúteos sin levantar la cadera.', 'Baja en 2–3 s.'],
    ['Cadera que se despega → peso que controles.', 'Recorrido corto → llega lo más cerca posible del glúteo.'],
    ['isq'],
  ),
  deadlift: t(
    ['Pies a la anchura de la cadera con la barra sobre el medio pie.', 'Agarre justo fuera de las piernas; espinillas tocando la barra.', 'Espalda neutra, pecho fuera, aire y abdomen firme.'],
    ['Empuja el suelo con las piernas y la barra pegada al cuerpo.', 'Cuando pase las rodillas, lleva la cadera adelante hasta quedar erguido.', 'Baja invirtiendo el movimiento: cadera atrás primero.'],
    ['Espalda redondeada → menos peso y tensa la espalda antes de tirar.', 'Barra lejos del cuerpo → que roce las piernas todo el recorrido.', 'Hiperextender arriba → termina de pie, sin echarte atrás.'],
    ['glut', 'isq', 'lumb'],
    'Ejercicio exigente: calienta con series ligeras antes de las pesadas.',
  ),
  rdl: t(
    ['De pie con la barra o mancuernas delante de los muslos.', 'Rodillas ligeramente flexionadas y fijas.'],
    ['Lleva la cadera atrás bajando la barra pegada a las piernas.', 'Baja hasta notar tirantez en los isquios (media espinilla aprox.).', 'Sube llevando la cadera adelante y apretando glúteos.'],
    ['Doblar las rodillas → mantenlas casi fijas, el movimiento es de cadera.', 'Espalda redondeada → baja solo hasta donde puedas mantenerla neutra.'],
    ['isq', 'glut'],
  ),
  hipthrust: t(
    ['Espalda alta apoyada en el borde de un banco y barra con almohadilla sobre la cadera.', 'Pies a la anchura de la cadera, espinillas verticales arriba.'],
    ['Empuja con los talones y sube la cadera hasta que el torso quede en línea con los muslos.', 'Aprieta glúteos 1 s y baja controlado.'],
    ['Arquear la zona lumbar arriba → barbilla al pecho y costillas abajo.', 'Pies muy lejos → trabajan los isquios; acércalos.'],
    ['glut'],
  ),
  kbswing: t(
    ['Kettlebell un poco por delante de los pies, pies algo más anchos que la cadera.', 'Espalda neutra.'],
    ['Lánzala hacia atrás entre las piernas con un movimiento de bisagra.', 'Lleva la cadera adelante con fuerza para proyectarla a la altura del pecho.', 'Deja que caiga y vuelve a la bisagra.'],
    ['Hacer una sentadilla → es cadera atrás, no rodillas abajo.', 'Subirla con los brazos → los brazos son cuerdas, empuja la cadera.'],
    ['glut', 'isq'],
  ),
  nordic: t(
    ['Elige tu nivel: excéntrico parcial, excéntrico completo, asistido con banda o completo.', 'De rodillas con los talones sujetos y el cuerpo recto.'],
    ['Inclínate hacia delante lo más despacio posible manteniendo la cadera estirada.', 'Frena con las manos al final y vuelve empujando un poco.'],
    ['Doblar la cadera → mantén la línea rodillas-hombros.', 'Caer rápido → controla la bajada aunque sea poco recorrido.'],
    ['isq'],
    'Muy exigente para los isquios: espera agujetas las primeras veces.',
  ),
  calf: t(
    ['De pie en un escalón con la parte delantera del pie, talones fuera.', 'Rodillas estiradas.'],
    ['Baja los talones hasta el máximo estiramiento y pausa 1 s.', 'Sube todo lo posible y aprieta 1 s.'],
    ['Rebotar abajo → pausa en el estiramiento.', 'Recorrido corto → llega arriba del todo.'],
    ['gem'],
  ),
  seated_calf: t(
    ['Sentado con las rodillas bajo el apoyo y la parte delantera del pie en la plataforma.'],
    ['Baja los talones hasta el máximo estiramiento y pausa 1 s.', 'Sube todo lo posible y aprieta.'],
    ['Rebotar → pausa abajo.', 'Ayudarse con las manos → peso que controles.'],
    ['gem'],
  ),

  // ---------- Fondos y palancas ----------
  dips: t(
    ['Lastre en cinturón; sube a las paralelas con los brazos bloqueados.', 'Hombros abajo, lejos de las orejas.'],
    ['Baja inclinándote ligeramente adelante hasta que los hombros queden a la altura de los codos.', 'Empuja hasta bloquear los brazos.'],
    ['Bajar demasiado → no pases de 90° si te molesta el hombro.', 'Hombros que suben → empuja las paralelas hacia abajo.'],
    ['pecho', 'tri'],
  ),
  flever: t(
    ['Elige tu nivel según tu progresión; agarre prono a la anchura de los hombros.', 'Brazos estirados y escápulas bajas.'],
    ['Lleva el cuerpo a la horizontal empujando la barra hacia las caderas.', 'Mantén la posición con la cadera en línea y el abdomen firme.'],
    ['Cadera caída → usa una progresión más fácil.', 'Brazos doblados → bloquea los codos.'],
    ['dors', 'abs'],
    'Cuenta el tiempo solo mientras mantienes la línea.',
  ),

  // ---------- Core ----------
  hlr: t(
    ['Colgado de una barra con agarre firme y hombros activos.'],
    ['Sube las piernas estiradas (o rodillas si no llegas) llevando la pelvis hacia arriba.', 'Baja despacio sin balancearte.'],
    ['Balanceo → para el cuerpo antes de cada rep.', 'Subir solo los muslos → enrolla la pelvis al final.'],
    ['abs'],
  ),
  plank: t(
    ['Antebrazos en el suelo, codos bajo los hombros.', 'Cuerpo en línea de cabeza a talones.'],
    ['Aprieta glúteos, abdomen y puños al máximo.', 'Intenta llevar los codos hacia los pies sin moverlos.'],
    ['Cadera alta o caída → línea recta.', 'Aguantar sin tensión → es una plancha corta e intensa, no larga.'],
    ['abs'],
  ),
  pallof: t(
    ['De lado a la polea a la altura del pecho, agarre con las dos manos pegado al esternón.', 'Pies a la anchura de la cadera.'],
    ['Extiende los brazos al frente sin dejar que el cable te gire.', 'Aguanta 2 s y vuelve al pecho.'],
    ['Rotar el torso → menos peso.', 'Cadera que se mueve → glúteos firmes.'],
    ['obl', 'abs'],
  ),
  abwheel: t(
    ['De rodillas, rueda bajo los hombros.', 'Pelvis ligeramente metida (glúteos apretados).'],
    ['Rueda hacia delante lo más lejos que puedas sin arquear la zona lumbar.', 'Vuelve tirando con el abdomen.'],
    ['Zona lumbar hundida → recorrido más corto.', 'Volver doblando la cadera → el abdomen tira, no la cadera.'],
    ['abs'],
  ),
  cablecrunch: t(
    ['De rodillas frente a la polea alta, cuerda sujeta junto a la cabeza.'],
    ['Enrolla la columna llevando los codos hacia los muslos.', 'Vuelve despacio estirando el abdomen.'],
    ['Tirar con los brazos o la cadera → la cadera queda fija, se mueve la columna.', 'Recorrido corto → enrolla del todo.'],
    ['abs'],
  ),
  deadbug: t(
    ['Boca arriba, brazos al techo y rodillas a 90° sobre la cadera.', 'Zona lumbar pegada al suelo.'],
    ['Estira un brazo atrás y la pierna contraria sin despegar la espalda.', 'Vuelve y alterna lado.'],
    ['La espalda se despega → recorrido más corto.', 'Ir rápido → despacio y respirando.'],
    ['abs'],
  ),
  sideplank: t(
    ['De lado, codo bajo el hombro y pies apilados.'],
    ['Sube la cadera hasta formar una línea recta.', 'Mantén sin dejar caer la cadera.'],
    ['Cadera atrás → empuja hacia delante.', 'Hombro hundido → empuja el suelo.'],
    ['obl'],
  ),
  woodchop: t(
    ['De lado a la polea alta, pies algo más anchos que la cadera.', 'Brazos casi estirados agarrando el asa.'],
    ['Lleva el asa en diagonal hacia la rodilla contraria girando el torso.', 'Vuelve despacio controlando la rotación.'],
    ['Tirar con los brazos → el giro viene del tronco.', 'Girar solo la cadera → pivota el pie de atrás.'],
    ['obl'],
  ),
  suitcase: t(
    ['Mancuerna pesada en una sola mano, la otra libre.'],
    ['Camina erguido sin inclinarte hacia el lado del peso.', 'Cambia de mano a mitad de tiempo.'],
    ['Inclinarse → el oblicuo contrario debe sostenerte.', 'Encoger el hombro → hombros nivelados.'],
    ['obl'],
  ),
  lsit: t(
    ['Elige tu nivel; manos en paralelas, suelo o anillas.', 'Brazos bloqueados y hombros hundidos.'],
    ['Sube las piernas estiradas hasta la horizontal (L) o más arriba (V).', 'Mantén empujando el suelo.'],
    ['Rodillas dobladas → usa la progresión con rodillas recogidas.', 'Hombros encogidos → empuja hacia abajo.'],
    ['abs'],
  ),

  // ---------- Cardio ----------
  z2: t(
    ['Ritmo en el que puedas hablar con frases completas (Z2).'],
    ['Zancada corta y cadencia alta (unos 170 pasos/min).', 'Aterriza bajo la cadera, no por delante.'],
    ['Ir demasiado rápido → si no puedes hablar, baja el ritmo.', 'Zancada larga y talonazo → pasos más cortos.'],
    [],
  ),
  bike: t(
    ['Sillín a la altura de la cadera: rodilla casi estirada abajo.'],
    ['Pedalea a 80–90 rpm a un ritmo en el que puedas hablar.', 'Torso relajado y hombros sueltos.'],
    ['Sillín bajo → molesta en la rodilla; súbelo.', 'Demasiada resistencia → baja carga, sube cadencia.'],
    ['quad', 'glut'],
  ),
  rower: t(
    ['Pies sujetos, agarre con brazos estirados.'],
    ['Orden al tirar: piernas, luego tronco y luego brazos.', 'Al volver al revés: brazos, tronco y piernas.'],
    ['Tirar con los brazos primero → las piernas dan el 60 % de la fuerza.', 'Encorvarse → pecho alto todo el rato.'],
    ['dors', 'quad'],
  ),
  incline_walk: t(
    ['Inclinación del 8–12 % y velocidad en la que puedas hablar.'],
    ['Paso natural y braceo relajado.', 'Mantén el ritmo constante.'],
    ['Agarrarse a la barandilla → suéltate o baja la inclinación.', 'Inclinarse hacia delante → camina erguido.'],
    ['glut', 'gem'],
  ),
  hiit: t(
    ['Calienta al menos 5 min suave.', 'Elige bici, remo o carrera.'],
    ['Intervalos cortos muy intensos (20–40 s) con recuperaciones suaves.', 'Termina con 5 min de vuelta a la calma.'],
    ['Hacerlo con las piernas cansadas → no lo pongas antes de un día de pierna.', 'Recuperaciones cortas → que el pulso baje antes del siguiente.'],
    [],
    'Alto impacto en la recuperación: máximo 1–2 por semana.',
  ),
  jumprope: t(
    ['Comba a la altura de las axilas al pisarla en el centro.'],
    ['Salta poco (2–3 cm) sobre la parte delantera del pie.', 'Gira la comba con las muñecas, codos pegados.'],
    ['Saltar alto → saltos pequeños y rápidos.', 'Girar con los brazos → solo muñecas.'],
    ['gem'],
  ),
};

const BREATHING: Record<Pattern, string> = {
  empuje: 'Coge aire al bajar y suéltalo al empujar, sin perder la tensión del abdomen.',
  traccion: 'Suelta el aire al tirar y cógelo al volver.',
  pierna: 'Coge aire y aprieta el abdomen antes de bajar; suéltalo al pasar la parte más difícil de la subida.',
  bisagra: 'Aire y abdomen firme antes de cada rep (bracing); suéltalo arriba.',
  core: 'Respira corto y controlado sin soltar la tensión del abdomen.',
  aislamiento: 'Suelta el aire en el esfuerzo y cógelo en la bajada.',
  aerobico: 'Respira por la nariz si puedes: es la señal de que vas en Z2.',
};

export const breathingFor = (p: Pattern) => BREATHING[p];

/** The user's own (or AI-generated) technique, else the built-in one. */
export const techniqueOf = (e: Pick<Exercise, 'id' | 'technique'>): ExerciseTechnique | undefined => e.technique ?? TECHNIQUE[e.id];

export const videoSearchUrl = (name: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} técnica correcta`)}`;
