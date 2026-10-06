const symbols = new Map([
  ['\\times', ' × '], ['\\cdot', ' · '], ['\\ast', ' ∗ '],
  ['\\implies', ' ⇒ '], ['\\Rightarrow', ' ⇒ '], ['\\rightarrow', ' → '],
  ['\\leftarrow', ' ← '], ['\\approx', ' ≈ '], ['\\neq', ' ≠ '],
  ['\\leq', ' ≤ '], ['\\geq', ' ≥ '], ['\\pm', ' ± '],
  ['\\infty', '∞'], ['\\sum', 'Σ'], ['\\prod', 'Π'],
  ['\\sqrt', '√'], ['\\partial', '∂'], ['\\nabla', '∇'],
  ['\\Delta', 'Δ'], ['\\delta', 'δ'], ['\\alpha', 'α'],
  ['\\beta', 'β'], ['\\gamma', 'γ'], ['\\theta', 'θ'],
  ['\\lambda', 'λ'], ['\\mu', 'μ'], ['\\pi', 'π'],
  ['\\sigma', 'σ'], ['\\omega', 'ω'], ['\\Phi', 'Φ'],
  ['\\Omega', 'Ω'], ['\\%','%'],
]);

const subscript = Object.fromEntries([...('0123456789+-=()')].map((c,i)=>[c,'₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎'[i]]));
Object.assign(subscript, {a:'ₐ',e:'ₑ',h:'ₕ',i:'ᵢ',j:'ⱼ',k:'ₖ',l:'ₗ',m:'ₘ',n:'ₙ',o:'ₒ',p:'ₚ',r:'ᵣ',s:'ₛ',t:'ₜ',u:'ᵤ',v:'ᵥ',x:'ₓ'});
const superscript = Object.fromEntries([...('0123456789+-=()')].map((c,i)=>[c,'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾'[i]]));
Object.assign(superscript, {n:'ⁿ',i:'ⁱ'});

function mapIndex(value, alphabet) {
  return [...value].map(char=>alphabet[char]??char).join('');
}

/** Convert common LaTeX notation into readable Unicode without loading a CDN. */
export function latexToReadable(input) {
  let text=String(input??'');
  text=text.replace(/\\\[|\\\]|\\\(|\\\)|\$\$?/g,'');
  text=text.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g,'$1');
  text=text.replace(/\\dot\s*\{([^{}]+)\}/g,'$1̇').replace(/\\bar\s*\{([^{}]+)\}/g,'$1̄').replace(/\\hat\s*\{([^{}]+)\}/g,'$1̂');
  text=text.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,'($1) / ($2)');
  for(const [latex,symbol] of symbols)text=text.split(latex).join(symbol);
  text=text.replace(/\\(?:left|right|displaystyle|quad|qquad)\b|\\[,;!]/g,' ');
  text=text.replace(/\\\\/g,'\n').replace(/\\([{}%_#&])/g,'$1');
  text=text.replace(/\^\{([^{}]+)\}/g,(_,value)=>mapIndex(value,superscript));
  text=text.replace(/\^([A-Za-z0-9+-]+)/g,(_,value)=>mapIndex(value,superscript));
  text=text.replace(/_\{([^{}]+)\}/g,(_,value)=>mapIndex(value,subscript));
  text=text.replace(/_([A-Za-z0-9]+)/g,(_,value)=>mapIndex(value,subscript));
  text=text.replace(/\\[A-Za-z]+/g,'');
  text=text.replace(/[{}]/g,'').replace(/\s+([,.;])/g,'$1').replace(/[ \t]{2,}/g,' ');
  return text.trim();
}
