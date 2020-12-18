export function simpleXyCoordinates (pair_table) {
  const INIT_ANGLE = 0.0 /* initial bending angle */
  const INIT_X = 100.0 /* coordinate of first digit */
  const INIT_Y = 100.0 /* see above */
  const RADIUS = 15.0

  const x = []; const y = []

  let i, len
  let alpha

  len = pair_table[0]
  const angle = Array.apply(null, new Array(len + 5)).map(Number.prototype.valueOf, 0)
  const loop_size = Array.apply(null, new Array(16 + Math.floor(len / 5)))
    .map(Number.prototype.valueOf, 0)
  const stack_size = Array.apply(null, new Array(16 + Math.floor(len / 5)))
    .map(Number.prototype.valueOf, 0)

  let lp = 0
  let stk = 0
  const PIHALF = Math.PI / 2

  var loop = function (i, j, pair_table)
  /* i, j are the positions AFTER the last pair of a stack; i.e
     i-1 and j+1 are paired. */
  {
    let count = 2 /* counts the VERTICES of a loop polygon; that's
                          NOT necessarily the number of unpaired bases!
                          Upon entry the loop has already 2 vertices, namely
                          the pair i-1/j+1.  */

    let r = 0; let bubble = 0 /* bubble counts the unpaired digits in loops */

    let i_old, partner, k, l, start_k, start_l, fill, ladder
    let begin, v, diff
    let polygon

    const remember = Array.apply(null, new Array((3 + Math.floor((j - i) / 5) * 2))).map(Number.prototype.valueOf, 0)

    i_old = i - 1, j++ /* j has now been set to the partner of the
                               previous pair for correct while-loop
                               termination.  */
    while (i != j) {
      partner = pair_table[i]
      if ((!partner) || (i == 0)) { i++, count++, bubble++ } else {
        count += 2
        k = i, l = partner /* beginning of stack */
        remember[++r] = k
        remember[++r] = l
        i = partner + 1 /* next i for the current loop */

        start_k = k, start_l = l
        ladder = 0
        do {
          k++, l--, ladder++ /* go along the stack region */
        }
        while ((pair_table[k] == l) && (pair_table[k] > k))

        fill = ladder - 2
        if (ladder >= 2) {
          angle[start_k + 1 + fill] += PIHALF /*  Loop entries and    */
          angle[start_l - 1 - fill] += PIHALF /*  exits get an        */
          angle[start_k] += PIHALF /*  additional PI/2.    */
          angle[start_l] += PIHALF /*  Why ? (exercise)    */
          if (ladder > 2) {
            for (; fill >= 1; fill--) {
              angle[start_k + fill] = Math.PI /*  fill in the angles  */
              angle[start_l - fill] = Math.PI /*  for the backbone    */
            }
          }
        }
        stack_size[++stk] = ladder
        if (k <= l) { loop(k, l, pair_table) }
      }
    }

    polygon = Math.PI * (count - 2) / count /* bending angle in loop polygon */
    remember[++r] = j
    begin = i_old < 0 ? 0 : i_old
    for (v = 1; v <= r; v++) {
      diff = remember[v] - begin
      for (fill = 0; fill <= diff; fill++) { angle[begin + fill] += polygon }
      if (v > r) { break }
      begin = remember[++v]
    }
    loop_size[++lp] = bubble
  }

  loop(0, len + 1, pair_table)
  loop_size[lp] -= 2 /* correct for cheating with function loop */

  alpha = INIT_ANGLE
  x[0] = INIT_X
  y[0] = INIT_Y

  const poss = []

  poss.push([x[0], y[0]])
  for (i = 1; i < len; i++) {
    x[i] = x[i - 1] + RADIUS * Math.cos(alpha)
    y[i] = y[i - 1] + RADIUS * Math.sin(alpha)

    poss.push([x[i], y[i]])
    alpha += Math.PI - angle[i + 1]
  }

  return poss
}
