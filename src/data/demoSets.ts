import type { QuestionSet } from '../types/cbt';

export const BUILT_IN_DEMO_SET_ID = 'builtin-jee-main-diagnostic-set-1';

export function createBuiltInDemoSet(): QuestionSet {
  const now = Date.now();
  return {
    id: BUILT_IN_DEMO_SET_ID,
    setTitle: 'JEE Main Full-Syllabus Diagnostic - Set 1',
    subject: 'Full Mock',
    chapter: 'Mechanics, Thermodynamics, Electrochemistry & Calculus',
    createdAt: now,
    updatedAt: now,
    isBuiltInDemo: true,
    questions: [
      {
        id: 1,
        type: 'MCQ',
        question:
          'A uniform solid cylinder of mass $M$ and radius $R$ rolls without slipping down an inclined plane of angle $\\theta = 30^\\circ$. Find the linear acceleration of its centre of mass along the incline (take acceleration due to gravity as $g$).',
        options: [
          '$\\frac{g}{2}$',
          '$\\frac{g}{3}$',
          '$\\frac{2g}{3}$',
          '$\\frac{g}{4}$',
        ],
        correctAnswer: '1',
        solution:
          'For rolling without slipping down an incline of angle $\\theta$:\n$$a = \\frac{g\\sin\\theta}{1 + \\frac{I}{MR^2}}$$\nFor a solid cylinder, $I = \\frac{1}{2}MR^2$, so $\\frac{I}{MR^2} = \\frac{1}{2}$.\nSubstituting $\\theta = 30^\\circ$ ($\\sin 30^\\circ = \\frac{1}{2}$):\n$$a = \\frac{g \\cdot \\frac{1}{2}}{1 + \\frac{1}{2}} = \\frac{g/2}{3/2} = \\frac{g}{3}$$',
      },
      {
        id: 2,
        type: 'MCQ',
        question:
          'An ideal monoatomic gas undergoes a polytropic process in which its molar heat capacity is $C = \\frac{9}{2}R$. If the initial volume is $V_0$ at temperature $T_0$ and it expands to $8V_0$, find the final temperature $T$.',
        options: [
          '$2T_0$',
          '$4T_0$',
          '$\\frac{T_0}{2}$',
          '$\\frac{T_0}{4}$',
        ],
        correctAnswer: '0',
        solution:
          'For a polytropic process $PV^x = \\text{constant}$, the molar heat capacity is:\n$$C = C_V + \\frac{R}{1 - x}$$\nFor a monoatomic ideal gas, $C_V = \\frac{3}{2}R$. Setting $C = \\frac{9}{2}R$:\n$$\\frac{9}{2}R = \\frac{3}{2}R + \\frac{R}{1 - x} \\implies \\frac{1}{1 - x} = 3 \\implies x = \\frac{2}{3}$$\nThus $PV^{2/3} = \\text{constant}$. Using $PV = nRT$, we obtain $TV^{-1/3} = \\text{constant}$, so $T \\propto V^{1/3}$.\nWhen $V$ increases from $V_0$ to $8V_0$:\n$$T = T_0 \\left(\\frac{8V_0}{V_0}\\right)^{1/3} = 2T_0$$',
      },
      {
        id: 3,
        type: 'MCQ',
        question:
          'In a Young\'s double-slit experiment using monochromatic light of wavelength $\\lambda = 600\\text{ nm}$, the angular width of a fringe formed on a distant screen is $0.1^\\circ$. What is the spacing $d$ between the two slits?',
        options: [
          '$0.344\\text{ mm}$',
          '$0.688\\text{ mm}$',
          '$0.172\\text{ mm}$',
          '$1.376\\text{ mm}$',
        ],
        correctAnswer: '0',
        solution:
          'Angular fringe width is given by $\\theta = \\frac{\\lambda}{d}$ (in radians).\nConverting $0.1^\\circ$ to radians:\n$$\\theta = 0.1 \\times \\frac{\\pi}{180} = \\frac{\\pi}{1800}\\text{ rad}$$\nTherefore:\n$$d = \\frac{\\lambda}{\\theta} = \\frac{600 \\times 10^{-9} \\times 1800}{\\pi} \\approx 3.438 \\times 10^{-4}\\text{ m} \\approx 0.344\\text{ mm}$$',
      },
      {
        id: 4,
        type: 'MCQ',
        question:
          'Consider the reversible contact-process equilibrium:\n$$\\ce{2SO2(g) + O2(g) <=> 2SO3(g)} \\quad (\\Delta H < 0)$$\nWhich of the following conditions will shift the equilibrium toward higher yield of $\\ce{SO3}$?',
        options: [
          'Increasing temperature and decreasing total pressure',
          'Decreasing temperature and increasing total pressure',
          'Adding an inert gas at constant volume',
          'Adding a positive catalyst at constant temperature and pressure',
        ],
        correctAnswer: '1',
        solution:
          'By Le Chatelier\'s Principle:\n1. The forward reaction is exothermic ($\\Delta H < 0$), so **lowering temperature** shifts equilibrium toward $\\ce{SO3}$.\n2. $\\Delta n_g = 2 - (2 + 1) = -1 < 0$ (fewer gas moles on product side), so **increasing pressure** shifts equilibrium forward.\nAdding an inert gas at constant volume or adding a catalyst does not alter equilibrium yield.',
      },
      {
        id: 5,
        type: 'MCQ',
        question:
          'In the volumetric titration of oxalic acid with acidified potassium permanganate:\n$$\\ce{2MnO4- + 5C2O4^{2-} + 16H+ -> 2Mn^{2+} + 10CO2 + 8H2O}$$\nWhat is the equivalent weight of $\\ce{KMnO4}$ (molar mass $M$) in this acidic medium?',
        options: [
          '$\\frac{M}{3}$',
          '$\\frac{M}{5}$',
          '$\\frac{M}{1}$',
          '$\\frac{2M}{5}$',
        ],
        correctAnswer: '1',
        solution:
          'In acidic medium, manganese in $\\ce{MnO4-}$ is reduced from $+7$ oxidation state to $+2$ in $\\ce{Mn^{2+}}$.\nThe $n$-factor (electrons gained per formula unit) is $7 - 2 = 5$.\nHence, equivalent weight $E = \\frac{M}{n\\text{-factor}} = \\frac{M}{5}$.',
      },
      {
        id: 6,
        type: 'MCQ',
        question:
          'The standard reduction potentials at $298\\text{ K}$ for $\\ce{Zn^{2+}/Zn}$ and $\\ce{Cu^{2+}/Cu}$ are $-0.76\\text{ V}$ and $+0.34\\text{ V}$ respectively. What is the standard Gibbs free energy change $\\Delta G^\\circ$ for the Daniell cell reaction $\\ce{Zn(s) + Cu^{2+}(aq) -> Zn^{2+}(aq) + Cu(s)}$? (Use $F = 96500\\text{ C mol}^{-1}$)',
        options: [
          '$-106.15\\text{ kJ mol}^{-1}$',
          '$-212.30\\text{ kJ mol}^{-1}$',
          '$+212.30\\text{ kJ mol}^{-1}$',
          '$-424.60\\text{ kJ mol}^{-1}$',
        ],
        correctAnswer: '1',
        solution:
          'Standard cell EMF:\n$$E^\\circ_{\\text{cell}} = E^\\circ_{\\text{cathode}} - E^\\circ_{\\text{anode}} = 0.34 - (-0.76) = 1.10\\text{ V}$$\nHere $n = 2$ moles of electrons are transferred, so:\n$$\\Delta G^\\circ = -nFE^\\circ_{\\text{cell}} = -2 \\times 96500 \\times 1.10 = -212300\\text{ J mol}^{-1} = -212.30\\text{ kJ mol}^{-1}$$',
      },
      {
        id: 7,
        type: 'MCQ',
        question:
          'Evaluate the definite integral:\n$$I = \\int_0^{\\pi/2} \\frac{\\sqrt{\\sin x}}{\\sqrt{\\sin x} + \\sqrt{\\cos x}}\\,dx$$',
        options: [
          '$\\frac{\\pi}{2}$',
          '$\\frac{\\pi}{4}$',
          '$\\frac{\\pi}{8}$',
          '$\\pi$',
        ],
        correctAnswer: '1',
        solution:
          'Using King\'s property $\\int_0^a f(x)\\,dx = \\int_0^a f(a - x)\\,dx$:\n$$I = \\int_0^{\\pi/2} \\frac{\\sqrt{\\cos x}}{\\sqrt{\\cos x} + \\sqrt{\\sin x}}\\,dx$$\nAdding both expressions:\n$$2I = \\int_0^{\\pi/2} 1\\,dx = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4}$$',
      },
      {
        id: 8,
        type: 'MCQ',
        question:
          'If $\\alpha$ and $\\beta$ are the roots of the quadratic equation $x^2 - 5x + 6 = 0$, find the value of $\\alpha^3 + \\beta^3$.',
        options: [
          '$25$',
          '$35$',
          '$45$',
          '$125$',
        ],
        correctAnswer: '1',
        solution:
          'From Vieta\'s formulas: $\\alpha + \\beta = 5$ and $\\alpha\\beta = 6$ (indeed roots are $2$ and $3$).\n$$\\alpha^3 + \\beta^3 = (\\alpha + \\beta)^3 - 3\\alpha\\beta(\\alpha + \\beta) = 5^3 - 3(6)(5) = 125 - 90 = 35$$',
      },
      {
        id: 9,
        type: 'NUMERICAL',
        question:
          'A particle of mass $2\\text{ kg}$ moves along the $x$-axis under a position-dependent force $F(x) = (3x^2 - 4x + 5)\\text{ N}$. Find the work done (in Joules) by this force in displacing the particle from $x = 0\\text{ m}$ to $x = 2\\text{ m}$.',
        options: [],
        correctAnswer: '10',
        tolerance: 0.01,
        solution:
          'Work done by a variable force along the $x$-axis is:\n$$W = \\int_0^2 F(x)\\,dx = \\int_0^2 (3x^2 - 4x + 5)\\,dx = \\left[x^3 - 2x^2 + 5x\\right]_0^2 = (8 - 8 + 10) - 0 = 10\\text{ J}$$',
      },
      {
        id: 10,
        type: 'NUMERICAL',
        question:
          'Find the pH of a $0.005\\text{ M}$ aqueous solution of $\\ce{H2SO4}$ at $298\\text{ K}$, assuming complete dissociation of both protons.',
        options: [],
        correctAnswer: '2',
        tolerance: 0.01,
        solution:
          'Assuming complete dissociation of $\\ce{H2SO4 -> 2H+ + SO4^{2-}}$:\n$$[\\ce{H+}] = 2 \\times 0.005\\text{ M} = 0.01\\text{ M} = 10^{-2}\\text{ M}$$\n$$\\text{pH} = -\\log_{10}(10^{-2}) = 2$$',
      },
    ],
  };
}

export function getSampleJsonTemplate(): string {
  const sample = {
    setTitle: 'Sample Template - Physics, Chemistry & Math',
    subject: 'Full Mock',
    chapter: 'Mixed Practice Template',
    questions: [
      {
        id: 1,
        type: 'MCQ',
        question:
          'A uniform disc of mass $M$ and radius $R$ rolls without slipping with centre-of-mass speed $v$. What is its total kinetic energy?',
        options: [
          '$\\frac{1}{2}Mv^2$',
          '$\\frac{3}{4}Mv^2$',
          '$Mv^2$',
          '$\\frac{2}{5}Mv^2$',
        ],
        correctAnswer: '1',
        solution:
          'Total kinetic energy is translational plus rotational:\n$$K = \\frac{1}{2}Mv^2 + \\frac{1}{2}I\\omega^2 = \\frac{1}{2}Mv^2 + \\frac{1}{2}\\left(\\frac{1}{2}MR^2\\right)\\left(\\frac{v}{R}\\right)^2 = \\frac{3}{4}Mv^2$$',
      },
      {
        id: 2,
        type: 'MCQ',
        question:
          'Evaluate the fundamental Gaussian-related limit:\n$$L = \\lim_{x \\to 0} \\frac{\\sin(3x) - 3x}{x^3}$$',
        options: [
          '$-\\frac{9}{2}$',
          '$\\frac{9}{2}$',
          '$-\\frac{3}{2}$',
          '$0$',
        ],
        correctAnswer: '0',
        solution:
          'Using the Taylor expansion $\\sin(u) = u - \\frac{u^3}{6} + O(u^5)$ with $u = 3x$:\n$$\\lim_{x \\to 0} \\frac{\\left(3x - \\frac{27x^3}{6}\\right) - 3x}{x^3} = -\\frac{27}{6} = -\\frac{9}{2}$$',
      },
      {
        id: 3,
        type: 'MCQ',
        question:
          'In the Haber-Bosch equilibrium $\\ce{N2(g) + 3H2(g) <=> 2NH3(g)}$, what is the relationship between $K_p$ and $K_c$ at temperature $T$?',
        options: [
          '$K_p = K_c(RT)^2$',
          '$K_p = K_c(RT)^{-2}$',
          '$K_p = K_c(RT)^{-1}$',
          '$K_p = K_c$',
        ],
        correctAnswer: '1',
        solution:
          'Here $\\Delta n_g = n_{\\text{products}} - n_{\\text{reactants}} = 2 - (1 + 3) = -2$.\nUsing $K_p = K_c(RT)^{\\Delta n_g}$, we obtain $K_p = K_c(RT)^{-2}$.',
      },
      {
        id: 4,
        type: 'NUMERICAL',
        question:
          'A projectile is launched with speed $20\\text{ m s}^{-1}$ at an angle of $30^\\circ$ above the horizontal. Taking $g = 10\\text{ m s}^{-2}$, find its maximum height (in meters).',
        options: [],
        correctAnswer: '5',
        tolerance: 0.01,
        solution:
          'Maximum height $H = \\frac{u^2 \\sin^2\\theta}{2g} = \\frac{20^2 \\times (0.5)^2}{2 \\times 10} = \\frac{400 \\times 0.25}{20} = 5\\text{ m}$.',
      },
    ],
  };

  return JSON.stringify(sample, null, 2);
}
