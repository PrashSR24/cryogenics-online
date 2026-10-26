/* Advanced Convection: flow engine add-on (buoyant flow solver, convection heroes, ODE helpers). Requires core.js. */
(function () {
  'use strict';
  const H = window.H, M = window.M;

  /* ---------------- ODE helpers ---------------- */
  // classic RK4 for a system y' = f(x, y); returns arrays of x and y-vectors
  M.rk4 = function (f, x0, y0, x1, n) {
    const h = (x1 - x0) / n, xs = [x0], ys = [y0.slice()]; let x = x0, y = y0.slice();
    for (let s = 0; s < n; s++) {
      const k1 = f(x, y), y2 = y.map((v, i) => v + 0.5 * h * k1[i]);
      const k2 = f(x + 0.5 * h, y2), y3 = y.map((v, i) => v + 0.5 * h * k2[i]);
      const k3 = f(x + 0.5 * h, y3), y4 = y.map((v, i) => v + h * k3[i]);
      const k4 = f(x + h, y4);
      y = y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); x += h;
      xs.push(x); ys.push(y.slice());
      if (!y.every(isFinite)) break;
    }
    return { x: xs, y: ys };
  };
  // secant shooting: find s so that g(s) = 0
  M.secant = function (g, s0, s1, tol, it) {
    let f0 = g(s0), f1 = g(s1);
    for (let k = 0; k < (it || 60); k++) {
      if (!isFinite(f1) || f1 === f0) break;
      const s2 = s1 - f1 * (s1 - s0) / (f1 - f0); s0 = s1; f0 = f1; s1 = s2; f1 = g(s1);
      if (Math.abs(f1) < (tol || 1e-10)) break;
    }
    return s1;
  };
  // modified Bessel K0 (Abramowitz & Stegun polynomial fits)
  M.K0 = function (x) {
    if (x <= 2) { const y = x * x / 4, t = x / 3.75, i0 = 1 + 3.5156229 * t * t + 3.0899424 * t ** 4 + 1.2067492 * t ** 6 + 0.2659732 * t ** 8 + 0.0360768 * t ** 10 + 0.0045813 * t ** 12;
      return -Math.log(x / 2) * i0 - 0.57721566 + 0.4227842 * y + 0.23069756 * y * y + 0.0348859 * y ** 3 + 0.00262698 * y ** 4 + 0.0001075 * y ** 5 + 0.0000074 * y ** 6; }
    const y = 2 / x; return Math.exp(-x) / Math.sqrt(x) * (1.25331414 - 0.07832358 * y + 0.02189568 * y * y - 0.01062446 * y ** 3 + 0.00587872 * y ** 4 - 0.0025154 * y ** 5 + 0.00053208 * y ** 6);
  };

  M.K1 = function (x) {
    if (x <= 2) { const y = x * x / 4, t = x / 3.75, i1 = x * (0.5 + 0.87890594 * t * t + 0.51498869 * t ** 4 + 0.15084934 * t ** 6 + 0.02658733 * t ** 8 + 0.00301532 * t ** 10 + 0.00032411 * t ** 12);
      return (x * Math.log(x / 2) * i1 + 1 + 0.15443144 * y - 0.67278579 * y * y - 0.18156897 * y ** 3 - 0.01919402 * y ** 4 - 0.00110404 * y ** 5 - 0.00004686 * y ** 6) / x; }
    const y = 2 / x; return Math.exp(-x) / Math.sqrt(x) * (1.25331414 + 0.23498619 * y - 0.0365562 * y * y + 0.01504268 * y ** 3 - 0.00780353 * y ** 4 + 0.00325614 * y ** 5 - 0.00068245 * y ** 6);
  };

  /* ---------------- cryogen & reference fluid properties (saturated liquid at 1 atm unless noted) ---------------- */
  // rhoL, rhoV kg/m3; hfg J/kg; sigma N/m; cpL J/kgK; muL Pa s; kL W/mK; Tsat K; kV, cpV, muV for vapour film; beta 1/K (liquid)
  H.FL = {
    water: { name: 'Water (100 °C)', Tsat: 373.15, rhoL: 958.4, rhoV: 0.597, hfg: 2.257e6, sigma: 0.0589, cpL: 4217, muL: 2.79e-4, kL: 0.679, kV: 0.0251, cpV: 2029, muV: 1.20e-5, Csf: 0.013 },
    ln2: { name: 'Liquid nitrogen (77 K)', Tsat: 77.35, rhoL: 806.1, rhoV: 4.61, hfg: 1.992e5, sigma: 8.85e-3, cpL: 2042, muL: 1.61e-4, kL: 0.1446, kV: 0.0075, cpV: 1123, muV: 5.4e-6, Csf: 0.013 },
    lh2: { name: 'Liquid hydrogen (20 K)', Tsat: 20.37, rhoL: 70.85, rhoV: 1.34, hfg: 4.46e5, sigma: 1.93e-3, cpL: 9740, muL: 1.33e-5, kL: 0.0990, kV: 0.0170, cpV: 12200, muV: 1.1e-6, Csf: 0.013 },
    lhe: { name: 'Liquid helium (4.2 K)', Tsat: 4.22, rhoL: 125.0, rhoV: 16.6, hfg: 2.07e4, sigma: 1.0e-4, cpL: 4480, muL: 3.3e-6, kL: 0.0186, kV: 0.0096, cpV: 9000, muV: 1.3e-6, Csf: 0.013 }
  };

  /* ---------------- buoyant incompressible flow solver (stable-fluids type, collocated grid) ----------------
     Grid j = 0 is the TOP row. v is positive downward. Buoyancy acts upward (toward smaller j).
     Qualitative but robust: used for animations. Quantitative problems use the dedicated solvers in each module. */
  class Fluid {
    constructor(nx, ny, o) {
      this.nx = nx; this.ny = ny; const N = nx * ny;
      this.o = Object.assign({ buoy: 0, kappa: 0.02, visc: 0, iters: 22, periodicX: false, openR: false, openT: false, openL: false, conf: 0, Tref: 0, decay: 1 }, o || {});
      ['u', 'v', 'u0', 'v0', 'p', 'dv', 'T', 'T0', 'w'].forEach((a) => (this[a] = new Float32Array(N)));
      this.solid = new Uint8Array(N); this.fixT = new Float32Array(N).fill(NaN); this.fixU = new Float32Array(N).fill(NaN); this.fixV = new Float32Array(N).fill(NaN);
    }
    idx(i, j) { return j * this.nx + i; }
    reset() { this.u.fill(0); this.v.fill(0); this.p.fill(0); this.T.fill(this.o.Tref); this.apply(); }
    apply() {
      const { u, v, T, solid, fixT, fixU, fixV } = this;
      for (let k = 0; k < u.length; k++) {
        if (solid[k]) { u[k] = 0; v[k] = 0; }
        if (fixU[k] === fixU[k]) u[k] = fixU[k];
        if (fixV[k] === fixV[k]) v[k] = fixV[k];
        if (fixT[k] === fixT[k]) T[k] = fixT[k];
      }
    }
    sample(a, x, y) {
      const nx = this.nx, ny = this.ny;
      if (this.o.periodicX) { x = ((x % nx) + nx) % nx; } else x = x < 0 ? 0 : x > nx - 1.001 ? nx - 1.001 : x;
      y = y < 0 ? 0 : y > ny - 1.001 ? ny - 1.001 : y;
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, i1 = this.o.periodicX ? (i + 1) % nx : Math.min(i + 1, nx - 1), j1 = Math.min(j + 1, ny - 1);
      return (1 - fy) * ((1 - fx) * a[j * nx + i] + fx * a[j * nx + i1]) + fy * ((1 - fx) * a[j1 * nx + i] + fx * a[j1 * nx + i1]);
    }
    advect(dst, src, dt) {
      const { nx, ny, u, v, solid } = this;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i; if (solid[k]) { dst[k] = src[k]; continue; }
        dst[k] = this.sample(src, i - dt * u[k], j - dt * v[k]);
      }
    }
    nb(k, i, j, di, dj) { // neighbour index or -1 (wall) / -2 (open)
      const nx = this.nx, ny = this.ny; let ii = i + di, jj = j + dj;
      if (ii < 0) { if (this.o.periodicX) ii = nx - 1; else return this.o.openL ? -2 : -1; }
      if (ii >= nx) { if (this.o.periodicX) ii = 0; else return this.o.openR ? -2 : -1; }
      if (jj < 0) return this.o.openT ? -2 : -1;
      if (jj >= ny) return -1;
      const kk = jj * nx + ii; return this.solid[kk] ? -1 : kk;
    }
    tables() { // neighbour tables, rebuilt when geometry or boundary flags change
      const sig = this.o.periodicX + this.o.openR + this.o.openT + this.o.openL + ':' + this.solidSum();
      if (this._sig === sig) return; this._sig = sig;
      const { nx, ny } = this, N = nx * ny; this.NB = new Int32Array(4 * N);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; this.NB[4 * k] = this.nb(k, i, j, 1, 0); this.NB[4 * k + 1] = this.nb(k, i, j, -1, 0); this.NB[4 * k + 2] = this.nb(k, i, j, 0, 1); this.NB[4 * k + 3] = this.nb(k, i, j, 0, -1); }
      // thermal table: solid cells with a fixed temperature conduct into the fluid
      this.NBT = new Int32Array(this.NB); const solid = this.solid, s0 = this.solid; this.solid = new Uint8Array(N);
      for (let k = 0; k < N; k++) if (s0[k] && this.fixT[k] !== this.fixT[k]) this.solid[k] = 1;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; this.NBT[4 * k] = this.nb(k, i, j, 1, 0); this.NBT[4 * k + 1] = this.nb(k, i, j, -1, 0); this.NBT[4 * k + 2] = this.nb(k, i, j, 0, 1); this.NBT[4 * k + 3] = this.nb(k, i, j, 0, -1); }
      this.solid = solid;
    }
    solidSum() { let s = 0; const a = this.solid, f = this.fixT; for (let k = 0; k < a.length; k++) { if (a[k]) s += k; if (f[k] === f[k]) s += 0.5 * k; } return s; }
    project() {
      this.tables();
      const { u, v, p, dv, solid, NB } = this, o = this.o, N = u.length;
      for (let k = 0; k < N; k++) {
        if (solid[k]) { dv[k] = 0; continue; }
        const r = NB[4 * k], l = NB[4 * k + 1], d = NB[4 * k + 2], t = NB[4 * k + 3];
        const ur = r >= 0 ? u[r] : r === -2 ? u[k] : 0, ul = l >= 0 ? u[l] : l === -2 ? u[k] : 0, vd = d >= 0 ? v[d] : d === -2 ? v[k] : 0, vt = t >= 0 ? v[t] : t === -2 ? v[k] : 0;
        dv[k] = -0.5 * (ur - ul + vd - vt);
      }
      for (let it = 0; it < o.iters; it++) {
        for (let k = 0; k < N; k++) {
          if (solid[k]) continue;
          const pk = p[k]; let s = dv[k];
          for (let q = 4 * k; q < 4 * k + 4; q++) { const n = NB[q]; s += n >= 0 ? p[n] : n === -2 ? 0 : pk; }
          p[k] = s * 0.25;
        }
      }
      for (let k = 0; k < N; k++) {
        if (solid[k]) continue;
        const pk = p[k], r = NB[4 * k], l = NB[4 * k + 1], d = NB[4 * k + 2], t = NB[4 * k + 3];
        const pr = r >= 0 ? p[r] : r === -2 ? 0 : pk, pl = l >= 0 ? p[l] : l === -2 ? 0 : pk, pd = d >= 0 ? p[d] : d === -2 ? 0 : pk, pt = t >= 0 ? p[t] : t === -2 ? 0 : pk;
        u[k] -= 0.5 * (pr - pl); v[k] -= 0.5 * (pd - pt);
      }
    }
    confine(eps) { // vorticity confinement keeps small eddies alive
      const { nx, ny, u, v, w, solid } = this;
      for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const k = j * nx + i; w[k] = 0.5 * (v[k + 1] - v[k - 1] - u[k + nx] + u[k - nx]); }
      for (let j = 2; j < ny - 2; j++) for (let i = 2; i < nx - 2; i++) {
        const k = j * nx + i; if (solid[k]) continue;
        const gx = 0.5 * (Math.abs(w[k + 1]) - Math.abs(w[k - 1])), gy = 0.5 * (Math.abs(w[k + nx]) - Math.abs(w[k - nx])), L = Math.hypot(gx, gy) + 1e-6;
        u[k] += eps * (gy / L) * w[k]; v[k] -= eps * (gx / L) * w[k];
      }
    }
    diffuseT(dt) {
      this.tables();
      const { T, T0, solid, fixT } = this, NB = this.NBT, a = this.o.kappa * dt, Tr = this.o.Tref, N = T.length;
      T0.set(T);
      for (let k = 0; k < N; k++) {
        if (solid[k] && fixT[k] !== fixT[k]) continue;
        let s = 0, c = 0;
        for (let q = 4 * k; q < 4 * k + 4; q++) { const n = NB[q]; if (n >= 0) { s += T0[n]; c++; } else if (n === -2) { s += Tr; c++; } }
        T[k] = T0[k] + a * (s - c * T0[k]);
      }
    }
    step(dt) {
      dt = dt || 1; const { u, v, T, u0, v0, T0, solid } = this, o = this.o, N = u.length;
      if (o.buoy) for (let k = 0; k < N; k++) if (!solid[k]) v[k] -= dt * o.buoy * (T[k] - o.Tref);
      if (o.force) o.force(this, dt);
      this.apply(); this.project();
      u0.set(u); v0.set(v); this.advect(u, u0, dt); this.advect(v, v0, dt);
      if (o.conf) this.confine(o.conf);
      if (o.visc) { u0.set(u); v0.set(v); const nx = this.nx; for (let k = nx; k < N - nx; k++) { if (solid[k]) continue; u[k] = u0[k] + o.visc * (u0[k - 1] + u0[k + 1] + u0[k - nx] + u0[k + nx] - 4 * u0[k]); v[k] = v0[k] + o.visc * (v0[k - 1] + v0[k + 1] + v0[k - nx] + v0[k + nx] - 4 * v0[k]); } }
      this.apply(); this.project(); this.apply();
      T0.set(T); this.advect(T, T0, dt); this.diffuseT(dt);
      if (o.decay !== 1) for (let k = 0; k < N; k++) if (this.fixT[k] !== this.fixT[k]) T[k] = o.Tref + (T[k] - o.Tref) * o.decay;
      this.apply();
    }
    maxSpeed() { let m = 0; for (let k = 0; k < this.u.length; k++) { const s = this.u[k] * this.u[k] + this.v[k] * this.v[k]; if (s > m) m = s; } return Math.sqrt(m); }
    // trace one particle path for overlays (streak / pathline)
    vel(x, y) { return [this.sample(this.u, x, y), this.sample(this.v, x, y)]; }
  }
  H.Fluid = Fluid;

  /* ---------------- enclosure solver: vorticity–stream function (or Darcy), validated against benchmark cavities ---------------- */
  H.Cavity = function (N, Ra, Pr, opts) {
    opts=opts||{}; const n=N+1, h=1/N, id=(i,j)=>j*n+i;
    const psi=new Float64Array(n*n), w=new Float64Array(n*n), T=new Float64Array(n*n), w2=new Float64Array(n*n), T2=new Float64Array(n*n);
    const mode=opts.mode||'side'; // 'side' heated from the side, 'below' heated from below
    const darcy=!!opts.darcy;     // Darcy porous medium: ∇²ψ = -Ra ∂T/∂x (ψ instantaneous)
    for(let j=0;j<n;j++) for(let i=0;i<n;i++){ T[id(i,j)]= mode==='side'?0.5-i*h:0.5-j*h; }
    if(opts.seed){ for(let k=0;k<n*n;k++) T[k]+=1e-3*Math.sin(k*12.9898)%1; }
    const S={N,Ra,Pr,psi,w,T,t:0,h,n,mode};
    let dt=0;
    function bcT(){ for(let k=0;k<n;k++){ if(mode==='side'){ T[id(0,k)]=0.5; T[id(N,k)]=-0.5; T[id(k,0)]=T[id(k,1)]*4/3-T[id(k,2)]/3; T[id(k,N)]=T[id(k,N-1)]*4/3-T[id(k,N-2)]/3; }
        else { T[id(k,0)]=0.5; T[id(k,N)]=-0.5; T[id(0,k)]=T[id(1,k)]*4/3-T[id(2,k)]/3; T[id(N,k)]=T[id(N-1,k)]*4/3-T[id(N-2,k)]/3; } } }
    function poisson(src,iters){ const om=2/(1+Math.sin(Math.PI*h)); for(let it=0;it<iters;it++){ for(let j=1;j<N;j++) for(let i=1;i<N;i++){ const k=id(i,j); const nv=0.25*(psi[k-1]+psi[k+1]+psi[k-n]+psi[k+n]+h*h*src(k)); psi[k]+=om*(nv-psi[k]); } } }
    function wallW(){ for(let k=0;k<n;k++){ w[id(0,k)]=-2*psi[id(1,k)]/(h*h); w[id(N,k)]=-2*psi[id(N-1,k)]/(h*h); w[id(k,0)]=-2*psi[id(k,1)]/(h*h); w[id(k,N)]=-2*psi[id(k,N-1)]/(h*h); } }
    S.step=function(nsteps){
      for(let s=0;s<nsteps;s++){
        if(darcy){ poisson(k=>{ const i=k%n; return mode==='side'? Ra*(T[k+1]-T[k-1])/(2*h) : Ra*(T[k+1]-T[k-1])/(2*h); }, 25); }
        else { poisson(k=>w[k],4); wallW(); }
        // velocities from psi: u = dψ/dy, v = -dψ/dx ; y up = j increasing
        let umax=1e-9; for(let j=1;j<N;j++) for(let i=1;i<N;i++){ const k=id(i,j); const u=(psi[k+n]-psi[k-n])/(2*h), v=-(psi[k+1]-psi[k-1])/(2*h); umax=Math.max(umax,Math.abs(u),Math.abs(v)); }
        const D=darcy?1:Math.max(Pr,1); dt=Math.min(0.2*h*h/D, 0.5*h/umax);
        for(let j=1;j<N;j++) for(let i=1;i<N;i++){ const k=id(i,j); const u=(psi[k+n]-psi[k-n])/(2*h), v=-(psi[k+1]-psi[k-1])/(2*h);
          const lapT=(T[k-1]+T[k+1]+T[k-n]+T[k+n]-4*T[k])/(h*h);
          const cT = u>0?u*(T[k]-T[k-1])/h:u*(T[k+1]-T[k])/h, cT2 = v>0?v*(T[k]-T[k-n])/h:v*(T[k+n]-T[k])/h;
          const cTc=u*(T[k+1]-T[k-1])/(2*h)+v*(T[k+n]-T[k-n])/(2*h);
          const pe=Math.max(Math.abs(u),Math.abs(v))*h; const cvT = pe<1.5?cTc:(cT+cT2);
          T2[k]=T[k]+dt*(lapT-cvT);
          if(!darcy){ const lapW=(w[k-1]+w[k+1]+w[k-n]+w[k+n]-4*w[k])/(h*h);
            const cWc=u*(w[k+1]-w[k-1])/(2*h)+v*(w[k+n]-w[k-n])/(2*h), cW=(u>0?u*(w[k]-w[k-1]):u*(w[k+1]-w[k]))/h+(v>0?v*(w[k]-w[k-n]):v*(w[k+n]-w[k]))/h;
            const pew=pe/Pr; const cvW=pew<1.5?cWc:cW;
            const b= mode==='side' ? Ra*Pr*(T[k+1]-T[k-1])/(2*h) : Ra*Pr*(T[k+1]-T[k-1])/(2*h);
            w2[k]=w[k]+dt*(Pr*lapW-cvW+b); } }
        for(let j=1;j<N;j++) for(let i=1;i<N;i++){ const k=id(i,j); T[k]=T2[k]; if(!darcy) w[k]=w2[k]; }
        bcT(); S.t+=dt;
      }
    };
    S.nu=function(){ // average Nu on the heated wall (second-order one-sided)
      let s=0; for(let k=0;k<n;k++){ let g; if(mode==='side') g=-(-3*T[id(0,k)]+4*T[id(1,k)]-T[id(2,k)])/(2*h); else g=-(-3*T[id(k,0)]+4*T[id(k,1)]-T[id(k,2)])/(2*h); s+=(k==0||k==N?0.5:1)*g; } return s*h; };
    S.psimax=function(){ let m=0; for(const p of psi) m=Math.max(m,Math.abs(p)); return m; };
    S.dt=()=>dt;
    S.heatfn=function(){ // heatfunction: dH/dy = uT - dT/dx, zero on the bottom wall
      const Hf=new Float64Array(n*n);
      for(let i=0;i<n;i++){ let acc=0; for(let j=1;j<n;j++){ const f=(jj)=>{ const k=id(i,jj); const u=(jj>0&&jj<N)?(psi[k+n]-psi[k-n])/(2*h):0; const dTx=i===0?(-3*T[k]+4*T[k+1]-T[k+2])/(2*h):i===N?(3*T[k]-4*T[k-1]+T[k-2])/(2*h):(T[k+1]-T[k-1])/(2*h); return u*T[k]-dTx; }; acc+=0.5*h*(f(j)+f(j-1)); Hf[id(i,j)]=acc; } }
      return Hf; };
    bcT();
    return S;
  };

  /* ---------------- convection heroes ---------------- */
  function setupHero(P, nx, ny, rnd) {
    const F = new Fluid(nx, ny, { kappa: 0.02 });
    const S = (i, j) => (F.solid[F.idx(i, j)] = 1), FT = (i, j, t) => (F.fixT[F.idx(i, j)] = t);
    const parts = [];
    const inflow = (U, prof) => { for (let j = 0; j < ny; j++) { const k = F.idx(0, j); F.fixU[k] = U * (prof ? prof(j) : 1); F.fixV[k] = 0; F.fixT[k] = 0; } F.o.openR = true; };
    if (P === 'bl') { inflow(0.6); F.o.openT = true; F.o.buoy = 0.005; F.o.kappa = 0.06; F.o.conf = 0.08; for (let i = 0; i < nx; i++) { S(i, ny - 1); if (i > nx * 0.12) FT(i, ny - 1, 1); } }
    if (P === 'duct') { inflow(0.5, (j) => 4 * (j / (ny - 1)) * (1 - j / (ny - 1)) * 1.4 + 0.05); for (let i = 0; i < nx; i++) { S(i, 0); S(i, ny - 1); if (i > nx * 0.1) { FT(i, 0, 1); FT(i, ny - 1, 1); } } F.o.kappa = 0.08; }
    if (P === 'plume' || P === 'jetplume') { F.o.buoy = 0.015; F.o.kappa = 0.05; F.o.openT = true; F.o.conf = 0.14; F.o.decay = 0.9985; [0.2, 0.5, 0.8].forEach((f) => { for (let i = -4; i <= 4; i++) { FT(Math.round(nx * f) + i, ny - 2, 1); FT(Math.round(nx * f) + i, ny - 3, 1); } }); }
    if (P === 'wall') { F.o.buoy = 0.012; F.o.kappa = 0.05; F.o.openT = true; F.o.openR = true; F.o.conf = 0.08; for (let j = 0; j < ny; j++) { S(0, j); FT(0, j, j > ny * 0.08 ? 1 : 0); FT(1, j, j > ny * 0.08 ? 1 : 0); } }
    if (P === 'cavity') { F.o.buoy = 0.02; F.o.kappa = 0.06; F.o.conf = 0.05; F.o.Tref = 0.5; for (let j = 0; j < ny; j++) { FT(0, j, 1); FT(nx - 1, j, 0); } F.T.fill(0.5); }
    if (P === 'benard' || P === 'boil') { F.o.buoy = P === 'boil' ? 0.03 : 0.02; F.o.kappa = 0.06; F.o.conf = 0.1; F.o.Tref = 0.5; F.o.periodicX = true; for (let i = 0; i < nx; i++) { FT(i, ny - 1, 1); FT(i, 0, 0); } for (let k = 0; k < nx * ny; k++) F.T[k] = 0.5 + 0.02 * (rnd() - 0.5); }
    if (P === 'shear') { F.o.periodicX = true; F.o.conf = 0.15; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = F.idx(i, j), s = Math.tanh((j - ny / 2) / 3); F.u[k] = -0.6 * s + 0.03 * Math.sin(2 * Math.PI * i / nx * 3) * Math.exp(-(((j - ny / 2) / 6) ** 2)); F.T[k] = 0.5 - 0.5 * s; } F.o.kappa = 0.004; F.persist = true; }
    if (P === 'cyl') { inflow(0.55); F.o.conf = 0.25; const cx = nx * 0.2, cy = ny * 0.5 + 0.5, r = ny * 0.12; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r) { S(i, j); FT(i, j, 1); } for (let i = 0; i < nx; i++) { S(i, 0); S(i, ny - 1); } F.o.kappa = 0.03; }
    if (P === 'jet') { F.o.openR = true; F.o.openT = true; F.o.conf = 0.18; F.o.kappa = 0.008; F.o.decay = 0.9997; const c = Math.round(ny / 2); for (let j = c - 3; j <= c + 3; j++) { const k = F.idx(0, j); F.fixU[k] = 0.9; F.fixV[k] = 0; F.fixT[k] = 1; } }
    if (P === 'porous') { F.o.buoy = 0.02; F.o.kappa = 0.08; F.o.Tref = 0.5; F.T.fill(0.5); for (let j = 0; j < ny; j++) { FT(0, j, 1); FT(nx - 1, j, 0); } for (let q = 0; q < 90; q++) { const ci = 4 + rnd() * (nx - 8), cj = 3 + rnd() * (ny - 6), r = 1.2 + rnd() * 2.2; for (let j = Math.floor(cj - r); j <= cj + r; j++) for (let i = Math.floor(ci - r); i <= ci + r; i++) if (i > 1 && i < nx - 2 && j >= 0 && j < ny && (i - ci) ** 2 + (j - cj) ** 2 <= r * r) S(i, j); } }
    if (P === 'mass') { inflow(0.5); F.o.openT = true; F.o.kappa = 0.06; for (let i = 0; i < nx; i++) S(i, ny - 1); for (let i = Math.round(nx * 0.25); i < nx * 0.55; i++) FT(i, ny - 1, 1); }
    if (P === 'cond') { F.o.buoy = 0.012; F.o.kappa = 0.05; F.o.Tref = 1; F.o.openR = true; F.o.openL = false; F.o.conf = 0.05; for (let j = 0; j < ny; j++) { S(0, j); FT(0, j, 0); FT(1, j, 0); } }
    if (P === 'boil') { for (let q = 0; q < 70; q++) parts.push({ x: rnd() * nx, y: ny - 1 - rnd() * ny, r: 0.6 + rnd() * 1.6 }); }
    F.reset(); if (P === 'shear') { /* reset clears u: rebuild */ for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = F.idx(i, j), s = Math.tanh((j - ny / 2) / 3); F.u[k] = -0.6 * s + 0.04 * Math.sin(2 * Math.PI * i / nx * 4) * Math.exp(-(((j - ny / 2) / 6) ** 2)); F.T[k] = 0.5 - 0.5 * s; } }
    if (P === 'cond') for (let k = 0; k < nx * ny; k++) if (F.fixT[k] !== F.fixT[k]) F.T[k] = 1;
    if (P === 'benard' || P === 'boil') for (let k = 0; k < nx * ny; k++) if (F.fixT[k] !== F.fixT[k]) F.T[k] = 0.5 + 0.04 * (rnd() - 0.5);
    return { F, parts };
  }

  H._setupHero = setupHero;
  H.chero = function (canvas, P) {
    if (!canvas) return;
    const nx = 128, ny = 72, rnd = M.mulberry(11);
    let st = setupHero(P, nx, ny, rnd), t = 0, mouse = null, last = null;
    const fld = new H.Field(canvas, { aspect: 9 / 16, bg: false });
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * nx, ((e.clientY - r.top) / r.height) * ny]; };
    canvas.addEventListener('pointermove', (e) => { const p = pos(e); mouse = { p, d: last ? [p[0] - last[0], p[1] - last[1]] : [0, 0] }; last = p; });
    canvas.addEventListener('pointerleave', () => { mouse = null; last = null; });
    canvas.addEventListener('dblclick', () => { st = setupHero(P, nx, ny, rnd); });
    const label = { bl: 'live · forced flow over a heated plate', duct: 'live · thermally developing duct flow', plume: 'live · buoyant plumes from heat sources', wall: 'live · natural convection on a hot wall', cavity: 'live · differentially heated cavity', benard: 'live · Rayleigh–Bénard convection', boil: 'live · heating from below with rising vapour', shear: 'live · Kelvin–Helmholtz shear layer', cyl: 'live · heated cylinder in cross-flow', jet: 'live · hot turbulent jet', porous: 'live · convection through a porous solid', mass: 'live · species boundary layer', cond: 'live · cold wall with falling flow' }[P] || 'live convection';
    const step = () => {
      t++; const F = st.F;
      if (mouse) {
        const [mx, my] = mouse.p, d = mouse.d;
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const ii = Math.round(mx + i), jj = Math.round(my + j); if (ii < 1 || jj < 1 || ii >= nx - 1 || jj >= ny - 1 || i * i + j * j > 9) continue; const k = F.idx(ii, jj); if (F.solid[k]) continue; F.T[k] = Math.max(F.T[k], 1); F.u[k] += 0.15 * d[0]; F.v[k] += 0.15 * d[1]; }
        mouse.d = [0, 0];
      }
      if (P === 'jet') { const c = Math.round(ny / 2); for (let j = c - 3; j <= c + 3; j++) F.fixV[F.idx(0, j)] = 0.06 * Math.sin(t * 0.07); }
      if (P === 'cyl' || P === 'bl') { for (let j = 1; j < ny - 1; j++) F.fixV[F.idx(0, j)] = 0.02 * Math.sin(t * 0.05 + j * 0.2); }
      F.step(1); if (t < 150) { F.step(1); F.step(1); }
      if (canvas.hasAttribute('data-fit')) fld.o.aspect = Math.max(0.3, Math.min(1.4, (canvas.parentElement.clientHeight || 500) / (canvas.clientWidth || 1000)));
      if (P === 'shear' && t % 900 === 0) st = setupHero(P, nx, ny, rnd);
      fld.draw(F.T, nx, ny, 0, 1.05, { overlay: (ctx, b) => {
        if (st.parts.length) { ctx.fillStyle = 'rgba(220,240,255,0.75)'; st.parts.forEach((q) => { const vv = F.vel(q.x, q.y); q.x += vv[0] * 0.8; q.y += vv[1] * 0.8 - 0.25 - q.r * 0.08; if (q.y < 1) { q.y = ny - 1.5; q.x = rnd() * nx; } q.x = ((q.x % nx) + nx) % nx; ctx.beginPath(); ctx.arc(b.l + (q.x / nx) * b.w, b.t + (q.y / ny) * b.h, q.r * b.w / nx * 1.3, 0, 7); ctx.fill(); }); }
        if (!canvas.hasAttribute('data-fit')) H.label(ctx, label + ' · drag to stir and heat', b.l + 10, b.t + b.h - 14, { color: 'rgba(255,255,255,0.78)', size: 10 });
      } });
    };
    H.anim(canvas, step);
  };

  /* ---------------- reusable qualitative flow sim widget ---------------- */
  // H.flowSim(sel, {title, setup(F, v), controls, draw:{vmin,vmax,cmap}, note}) builds a sim with play/reset
  H.flowSim = function (sel, spec) {
    const S = H.sim(sel, { tag: spec.tag || 'Live flow', title: spec.title, canvases: [{ id: 'f', cbar: spec.cbar || ['cold', '', 'hot'] }], controls: spec.controls || [], readouts: spec.readouts, note: spec.note });
    if (!S) return null;
    const nx = spec.nx || 128, ny = spec.ny || 64; let F;
    const fld = new H.Field(S.c.f, { aspect: ny / nx });
    const build = () => { F = new Fluid(nx, ny, {}); spec.setup(F, S.v, M.mulberry(5)); };
    build(); let t = 0;
    const anim = H.anim(S.c.f, () => { for (let s = 0; s < (spec.substeps || 1); s++) { F.step(1); t++; } fld.draw(F.T, nx, ny, spec.vmin == null ? 0 : spec.vmin, spec.vmax == null ? 1 : spec.vmax, { contours: spec.contours, contourColor: 'rgba(255,255,255,0.35)', overlay: (ctx, b) => spec.overlay && spec.overlay(ctx, b, F, t) }); spec.read && spec.read(S, F, t); });
    S.playBtn(anim); S.headBtn('Reset', () => { build(); t = 0; });
    S.on(() => { if (spec.live) spec.live(F, S.v); else { build(); t = 0; } });
    S.F = () => F;
    return S;
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('canvas[data-chero]').forEach((c) => H.chero(c, c.dataset.chero));
  });
})();
