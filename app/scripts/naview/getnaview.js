const NAView = require('./naview')

getCoordsNAVIEW = module.exports = function (nodes, links) {
  // Calculates coordinates according to the NAView layout
  const pairTable = []

  for (var i = 0; i < nodes.length; i++) {
    pairTable.push(getPartner(i, links))
  }
  const naView = new NAView()
  const xy = naView.naview_xy_coordinates(pairTable)

  // Updating individual base positions
  const coords = []
  for (var i = 0; i < nodes.length; i++) {
    coords.push({
      x: Math.round(xy.x[i] * 2.5),
      y: Math.round(xy.y[i] * 2.5)
    })
  }
  return coords
}

function getPartner (srcIndex, links) {
  // Returns the partner of a nucleotide:
  // -1 means there is no partner
  let partner = -1
  for (let i = 0; i < links.length; i++) {
    if (links[i].type !== 'phosphodiester' && links[i].type !== 'index') {
      if (links[i].source === srcIndex) {
        partner = links[i].target
        break
      } else if (links[i].target === srcIndex) {
        partner = links[i].source
        break
      } else {
        continue
      }
    }
  }
  return partner
}
