import '../styles/fornac.css'
import * as d3 from 'd3'
import { RNAGraph, ProteinGraph } from './rnagraph.js'
import { simpleXyCoordinates } from './simplernaplot.js'
import { ColorScheme } from 'rnautils'
import { NAView } from './naview/naview.js'
import { v4 as generateUUID } from 'uuid'
export { RNAGraph, ProteinGraph } from './rnagraph.js'
export { rnaPlot } from './rnaplot.js'

export function FornaContainer (element, passedOptions) {
  const self = this

  self.options = {
    displayAllLinks: false,
    labelInterval: 10,
    applyForce: true,
    chargeDistance: 110,
    friction: 0.35,
    middleCharge: -30,
    otherCharge: -30,
    linkDistanceMultiplier: 15,
    initialSize: null,
    layout: 'standard-polygonal',
    allowPanningAndZooming: true,
    transitionDuration: 500,
    resizeSvgOnResize: true // change the size of the svg when resizing the container
    // sometimes its beneficial to turn this off, especially when
    // performance is an issue
  }

  if (arguments.length > 1) {
    for (const option in passedOptions) {
      if (option in self.options) { self.options[option] = passedOptions[option] }
    }
  }

  if (self.options.initialSize !== null) {
    self.options.svgW = self.options.initialSize[0]
    self.options.svgH = self.options.initialSize[1]
  } else {
    self.options.svgW = 800
    self.options.svgH = 800
  }

  // mouse event vars
  let mousedownNode = null
  let mouseupNode = null

  const xScale = d3.scaleLinear()
    .domain([0, self.options.svgW]).range([0, self.options.svgW])
  const yScale = d3.scaleLinear()
    .domain([0, self.options.svgH]).range([0, self.options.svgH])

  const graph = self.graph = {
    nodes: [],
    links: []
  }

  self.linkStrengths = {
    pseudoknot: 0.00,
    proteinChain: 0.00,
    chainChain: 0.00,
    intermolecule: 10.00,
    external: 0.00,
    other: 10.00
  }

  self.displayParameters = {
    displayBackground: 'true',
    displayNumbering: 'true',
    displayNodeOutline: 'true',
    displayNodeLabel: 'true',
    displayLinks: 'true',
    displayPseudoknotLinks: 'true',
    displayProteinLinks: 'true'
  }

  self.colorScheme = 'structure'
  self.customColors = {}
  self.animation = self.options.applyForce
  // don't listen to events because a model window is open somewhere
  self.deaf = false
  self.rnas = {}
  self.extraLinks = [] // store links between different RNAs

  self.createInitialLayout = function (structure, passedOptions) {
    // the default options
    const options = {
      sequence: '',
      name: 'empty',
      positions: [],
      labelInterval: self.options.labelInterval,
      avoidOthers: true,
      uids: [],
      circularizeExternal: true
    }

    if (arguments.length === 2) {
      for (const option in passedOptions) {
        if (option in options) { options[option] = passedOptions[option] }
      }
    }

    const rg = new RNAGraph(options.sequence, structure, options.name)
    rg.circularizeExternal = options.circularizeExternal

    let rnaJson = rg.recalculateElements()

    if (options.positions.length === 0) {
      // no provided positions means we need to calculate an initial layout

      if (self.options.layout === 'naview') {
        const naview = new NAView()

        const naViewPositions = naview.naview_xy_coordinates(rg.pairtable)
        options.positions = []
        for (let i = 0; i < naViewPositions.nbase; i++) { options.positions.push([naViewPositions.x[i], naViewPositions.y[i]]) }
      } else {
        options.positions = simpleXyCoordinates(rnaJson.pairtable)
      }
    }

    rnaJson = rnaJson.elementsToJson()
      .addUids(options.uids)
      .addPositions('nucleotide', options.positions)
      .addLabels(1, options.labelInterval)
      .reinforceStems()
      .reinforceLoops()
      .connectFakeNodes()
      .reassignLinkUids()
      .breakNodesToFakeNodes()

    return rnaJson
  }

  self.addRNA = function (structure, passedOptions) {
    const rnaJson = self.createInitialLayout(structure, passedOptions)

    /*
     * Code to display the JSONs representing the structure
     *
    rnaJson.nodes[0].rna = null;
    rnaJson.nodes[0].nextNode = null;

    rnaJson.links[0].source = null;
    rnaJson.links[0].target = null;

    console.log(rnaJson.nodes[0]);
    console.log(rnaJson.links[0]);
    console.log(JSON.stringify(rnaJson.nodes[0],null,2));
    console.log(JSON.stringify(rnaJson.links[0],null,2));
    */

    if (arguments.length === 1) { passedOptions = {} }

    if ('extraLinks' in passedOptions) {
      // presumably the passed in links are within the passed molecule
      const newLinks = self.addExternalLinks(rnaJson, passedOptions.extraLinks)

      self.extraLinks = self.extraLinks.concat(newLinks)
    }

    if ('avoidOthers' in passedOptions) { self.addRNAJSON(rnaJson, passedOptions.avoidOthers) } else { self.addRNAJSON(rnaJson, true) }

    return rnaJson
  }

  self.addExternalLinks = function (rnaJson, externalLinks) {
    const newLinks = []

    for (let i = 0; i < externalLinks.length; i++) {
      const newLink = {
        linkType: 'external',
        value: 1,
        uid: generateUUID(),
        source: null,
        target: null
      }
      // check if the source node is an array
      if (Object.prototype.toString.call(externalLinks[i][0]) === '[object Array]') {
        for (let j = 0; j < rnaJson.nodes.length; j++) {
          if ('nucs' in rnaJson.nodes[j]) {
            if (rnaJson.nodes[j].nucs.equals(externalLinks[i][0])) {
              newLink.source = rnaJson.nodes[j]
              break
            }
          }
        }
      } else {
        for (let j = 0; j < rnaJson.nodes.length; j++) {
          if (rnaJson.nodes[j].num === externalLinks[i][0]) {
            newLink.source = rnaJson.nodes[j]
          }
        }
      }

      // check if the target node is an array
      if (Object.prototype.toString.call(externalLinks[i][1]) === '[object Array]') {
        for (let j = 0; j < rnaJson.nodes.length; j++) {
          if ('nucs' in rnaJson.nodes[j]) {
            if (rnaJson.nodes[j].nucs.equals(externalLinks[i][1])) {
              newLink.target = rnaJson.nodes[j]
            }
          }
        }
      } else {
        for (let j = 0; j < rnaJson.nodes.length; j++) {
          if (rnaJson.nodes[j].num === externalLinks[i][1]) {
            newLink.target = rnaJson.nodes[j]
          }
        }
      }

      if (newLink.source === null || newLink.target === null) {
        console.log('ERROR: source or target of new link not found:', newLink, externalLinks[i])
        continue
      }

      newLinks.push(newLink)
    }

    return newLinks
  }

  self.addRNAJSON = function (rnaGraph, avoidOthers) {
    // Add an RNAGraph, which contains nodes and links as part of the
    // structure
    // Each RNA will have uid to identify it
    // when it is modified, it is replaced in the global list of RNAs
    //
    let maxX, minX

    if (avoidOthers) {
      if (self.graph.nodes.length > 0) { maxX = d3.max(self.graph.nodes.map(function (d) { return d.x })) } else { maxX = 0 }

      minX = d3.min(rnaGraph.nodes.map(function (d) { return d.x }))

      rnaGraph.nodes.forEach(function (node) {
        node.x += (maxX - minX) + 20
        node.px += (maxX - minX)
      })
    }

    rnaGraph.nodes.forEach(function (node) {
      node.rna = rnaGraph
    })

    self.rnas[rnaGraph.uid] = rnaGraph
    self.recalculateGraph()

    self.update()
    self.centerView()

    return rnaGraph
  }

  function magnitude (x) {
    return Math.sqrt(x[0] * x[0] + x[1] * x[1])
  }

  function positionAnyNode (d) {
    const endPoint = d
    const startPoint = d.prevNode
    const lengthMult = 6

    if (startPoint === null) { return }

    // does this node have a link pointing to it?
    if (!d.linked) { return }

    // point back toward the previous node
    let u = [-(endPoint.x - startPoint.x), -(endPoint.y - startPoint.y)]
    u = [u[0] / magnitude(u), u[1] / magnitude(u)]
    const v = [-u[1], u[0]]

    const arrowTip = [d.radius * u[0], d.radius * u[1]]

    const path = 'M' +
          (arrowTip[0] + lengthMult * (u[0] + v[0]) / 2) + ',' + (arrowTip[1] + lengthMult * (u[1] + v[1]) / 2) + 'L' +
          (arrowTip[0]) + ',' + (arrowTip[1]) + 'L' +
          (arrowTip[0] + lengthMult * (u[0] - v[0]) / 2) + ',' + (arrowTip[1] + lengthMult * (u[1] - v[1]) / 2)

    d3.select(this).attr('d', path)
  }

  function realLinkFilter (d) {
    return d.linkType === 'basepair' ||
         d.linkType === 'backbone' ||
         d.linkType === 'pseudoknot' ||
         d.linkType === 'label_link' ||
         d.linkType === 'external' ||
         d.linkType === 'chain_chain'
  }

  self.transitionRNA = function (newStructure, nextFunction) {
    // transition from an RNA which is already displayed to a new structure
    const duration = self.options.transitionDuration

    const uids = self.graph.nodes
      .filter(function (d) { return d.nodeType === 'nucleotide' })
      .map(function (d) { return d.uid })

    const options = { uids: uids }
    const newRNAJson = self.createInitialLayout(newStructure, options)

    const gnodes = visNodes.selectAll('g.gnode').data(newRNAJson.nodes, nodeKey)

    if (duration === 0) {
      gnodes.attr('transform', function (d) {
        return 'translate(' + [d.x, d.y] + ')'
      })
    } else {
      gnodes.transition().attr('transform', function (d) {
        return 'translate(' + [d.x, d.y] + ')'
      }).duration(duration)
    }

    const links = visLinks.selectAll('line.link')
      .data(newRNAJson.links.filter(realLinkFilter), linkKey)
    const newNodes = self.createNewNodes(gnodes.enter())
      .attr('transform', function (d) {
        if (typeof d.x !== 'undefined' && typeof d.y !== 'undefined') { return 'translate(' + [0, 0] + ')' } else { return '' }
      })

    if (duration === 0) { gnodes.exit().remove() } else {
      gnodes.exit().transition()
        .attr('transform', function (d) {
          if (typeof d.x !== 'undefined' && typeof d.y !== 'undefined') { return 'translate(' + [0, 0] + ')' } else { return '' }
        })
    }

    gnodes.select('path')
      .each(positionAnyNode)

    self.graph.nodes = gnodes.data()
    self.updateStyle()
    self.centerView(duration)

    function endall (transition, callback) {
      if (transition.size() === 0) { setTimeout(callback, duration) }
      let n = 0
      transition
        .each(function () { ++n })
        .each('end', function () { if (!--n) callback.apply(this, arguments) })
    }

    function addNewLinks () {
      self.createNewLinks(links.enter())
      self.graph.links = links.data()

      self.updateStyle()

      if (typeof nextFunction !== 'undefined') { nextFunction() }
    }

    links.exit().remove()

    if (duration === 0) {
      links
        .attr('x1', function (d) { return d.source.x })
        .attr('y1', function (d) { return d.source.y })
        .attr('x2', function (d) { return d.target.x })
        .attr('y2', function (d) { return d.target.y })

      self.createNewLinks(links.enter())
      self.graph.links = links.data()

      self.updateStyle()
    } else {
      links.transition()
        .attr('x1', function (d) { return d.source.x })
        .attr('y1', function (d) { return d.source.y })
        .attr('x2', function (d) { return d.target.x })
        .attr('y2', function (d) { return d.target.y })
        .duration(duration)
        .call(endall, addNewLinks)
    }

    if (duration === 0) {
      newNodes
        .attr('transform', function (d) {
          if (typeof d.x !== 'undefined' && typeof d.y !== 'undefined') { return 'translate(' + [d.x, d.y] + ')' } else { return '' }
        })
    } else {
      newNodes.transition()
        .attr('transform', function (d) {
          if (typeof d.x !== 'undefined' && typeof d.y !== 'undefined') { return 'translate(' + [d.x, d.y] + ')' } else { return '' }
        })
    }
  }

  self.recalculateGraph = function () {
    // Condense all of the individual RNAs into one
    // collection of nodes and links
    self.graph.nodes = []
    self.graph.links = []
    for (const uid in self.rnas) {
      self.graph.nodes = self.graph.nodes.concat(self.rnas[uid].nodes)
      self.graph.links = self.graph.links.concat(self.rnas[uid].links)
    }

    // Create a lookup table so that we can access each node
    // based on its uid. This will be used to create the links
    // between different RNAs
    const uidsToNodes = {}

    for (let i = 0; i < self.graph.nodes.length; i++) { uidsToNodes[self.graph.nodes[i].uid] = self.graph.nodes[i] }

    self.graph.links.forEach(function (link) {
      link.source = uidsToNodes[link.source.uid]
      link.target = uidsToNodes[link.target.uid]
    })

    for (let i = 0; i < self.extraLinks.length; i++) {
      // the actual node objects may have changed, so we hae to recreate
      // the extra links based on the uids

      if (!(self.extraLinks[i].target.uid in uidsToNodes)) {
        console.log('not there:', self.extraLinks[i])
      }

      self.extraLinks[i].source = uidsToNodes[self.extraLinks[i].source.uid]
      self.extraLinks[i].target = uidsToNodes[self.extraLinks[i].target.uid]

      if (self.extraLinks[i].linkType === 'intermolecule') {
        // remove links to middle nodes
        const fakeLinks = self.graph.links.filter(function (d) {
          return ((d.source === self.extraLinks[i].source || d.source === self.extraLinks[i].target ||
              d.target === self.extraLinks[i].source || d.target === self.extraLinks[i].source) &&
              d.linkType === 'fake')
        })

        for (let j = 0; j < fakeLinks.length; j++) {
          const linkIndex = self.graph.links.indexOf(fakeLinks[j])
          self.graph.links.splice(linkIndex, 1)
        }
      }

      graph.links.push(self.extraLinks[i])
    }
  }

  self.addNodes = function addNodes (json) {
    // add a new set of nodes from a json file

    // Resolve the sources and targets of the links so that they
    // are not just indeces into an array
    json.links.forEach(function (entry) {
      if (typeof entry.source === 'number') entry.source = json.nodes[entry.source]
      if (typeof entry.target === 'number') entry.target = json.nodes[entry.target]
    })

    // Get the maximum x and y values of the current graph
    // so that we don't place a new structure on top of the
    // old one
    let maxX, maxY
    if (self.graph.nodes.length > 0) {
      maxX = d3.max(self.graph.nodes.map(function (d) { return d.x }))
      maxY = d3.max(self.graph.nodes.map(function (d) { return d.y }))
    } else {
      maxX = 0
      maxY = 0
    }

    json.nodes.forEach(function (entry) {
      if (!(entry.rna.uid in self.rnas)) {
        self.rnas[entry.rna.uid] = entry.rna
      }

      entry.x += maxX
      entry.y += maxY

      entry.px += maxX
      entry.py += maxY
    })

    const r = new RNAGraph('', '')
    r.nodes = json.nodes
    r.links = json.links

    // self.addRNA(r);
    self.recalculateGraph()

    self.update()
    self.centerView()
  }

  self.addCustomColors = function addCustomColors (json) {
    // Add a json file containing the custom colors
    self.customColors = json
  }

  self.addCustomColorsText = function (customColorsText) {
    const cs = new ColorScheme(customColorsText)
    self.customColors = cs.colorsJson
    self.changeColorScheme('custom')
  }

  self.clearNodes = function clearNodes () {
    self.graph.nodes = []
    self.graph.links = []

    self.rnas = {}
    self.extraLinks = []

    self.update()
  }

  self.toJSON = function toJSON () {
    const data = { rnas: self.rnas, extraLinks: self.extraLinks }
    const dataString = JSON.stringify(data, function (key, value) {
      // remove circular references
      if (key !== 'rna') {
        return value
      }
    }, '\t')
    return dataString
  }

  self.fromJSON = function (jsonString) {
    const data = JSON.parse(jsonString)
    const rnas = data.rnas
    const extraLinks = data.extraLinks

    for (const uid in rnas) {
      let r

      if (rnas[uid].type === 'rna') {
        r = new RNAGraph()
        r.seq = rnas[uid].seq
        r.dotbracket = rnas[uid].dotbracket
        r.circular = rnas[uid].circular
        r.pairtable = rnas[uid].pairtable
        r.uid = rnas[uid].uid
        r.structName = rnas[uid].structName
        r.nodes = rnas[uid].nodes
        r.links = rnas[uid].links
        r.rnaLength = rnas[uid].rnaLength
        r.elements = rnas[uid].elements
        r.nucsToNodes = rnas[uid].nucsToNodes
        r.pseudoknotPairs = rnas[uid].pseudoknotPairs
      } else {
        r = new ProteinGraph()
        r.size = rnas[uid].size
        r.nodes = rnas[uid].nodes
        r.uid = rnas[uid].uid
      }

      self.addRNAJSON(r, false)
    }

    extraLinks.forEach(function (link) {
      self.extraLinks.push(link)
    })

    self.recalculateGraph()
    self.update()
  }

  self.setSize = function () {
    if (self.options.initialSize != null) { return }

    const svgH = d3.select(element).node().offsetHeight
    const svgW = d3.select(element).node().offsetWidth

    self.options.svgW = svgW
    self.options.svgH = svgH

    // Set the output range of the scales
    xScale.range([0, svgW]).domain([0, svgW])
    yScale.range([0, svgH]).domain([0, svgH])

    // re-attach the scales to the zoom behaviour
    // self.zoomer.x(xScale)
    // .y(yScale);

    self.brusher.x(xScale)
      .y(yScale)

    self.centerView()

    if (!self.options.resizeSvgOnResize) {
      return
    }

    // resize the background
    /*
    rect.attr('width', svgW)
    .attr('height', svgH);
    */

    svg.attr('width', svgW)
      .attr('height', svgH)
  }

  function changeColors (moleculeColors, d, scale) {
    if (d.num in moleculeColors) {
      const val = parseFloat(moleculeColors[d.num])

      if (isNaN(val)) {
        // passed in color is not a scalar, so
        // treat it as a color
        return moleculeColors[d.num]
      } else {
        // the user passed in a float, let's use a colormap
        // to convert it to a color
        return scale(val)
      }
    } else {
      return 'white'
    }
  }

  self.setOutlineColor = function (color) {
    const nodes = visNodes.selectAll('g.gnode').select('[node_type=nucleotide]')
    nodes.style('fill', color)
  }

  self.changeColorScheme = function (newColorScheme) {
    const proteinNodes = visNodes.selectAll('[node_type=protein]')

    proteinNodes.classed('protein', true)
      .attr('r', function (d) { return d.radius })

    const nodes = visNodes.selectAll('g.gnode').select('[node_type=nucleotide]')
    self.colorScheme = newColorScheme

    if (newColorScheme === 'sequence') {
      const scale = d3.scaleOrdinal()
        .range(['#dbdb8d', '#98df8a', '#ff9896', '#aec7e8', '#aec7e8'])
        .domain(['A', 'C', 'G', 'U', 'T'])
      nodes.style('fill', function (d) {
        return scale(d.name)
      })
    } else if (newColorScheme === 'structure') {
      const scale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(['s', 'm', 'i', 'e', 't', 'h', 'x'])
        .range(['lightgreen', '#ff9896', '#dbdb8d', 'lightsalmon',
          'lightcyan', 'lightblue', 'transparent'])

      nodes.style('fill', function (d) {
        return scale(d.elemType)
      })
    } else if (newColorScheme === 'positions') {
      nodes.style('fill', function (d) {
        const scale = d3.scaleLinear()
          .range(['#98df8a', '#dbdb8d', '#ff9896'])
          .interpolate(d3.interpolateLab)
          .domain([1, 1 + (d.rna.rnaLength - 1) / 2, d.rna.rnaLength])

        return scale(d.num)
      })
    } else if (newColorScheme === 'custom') {
      // scale to be used in case the user passes scalar
      // values rather than color names
      const scale = d3.scaleLinear()
        .interpolate(d3.interpolateLab)
        .domain(self.customColors.domain)
        .range(self.customColors.range)

      nodes.style('fill', function (d) {
        if (typeof self.customColors === 'undefined' ||
           !('colorValues' in self.customColors.hasOwnProperty)) {
          return 'white'
        }

        if (d.structName in self.customColors.colorValues &&
            d.num in self.customColors.colorValues[d.structName]) {
          // if a molecule name is specified, it supercedes the default colors
          // (for which no molecule name has been specified)
          const moleculeColors = self.customColors.colorValues[d.structName]
          return changeColors(moleculeColors, d, scale)
        } else if ('' in self.customColors.colorValues) {
          const moleculeColors = self.customColors.colorValues['']
          return changeColors(moleculeColors, d, scale)
        }

        return 'white'
      })
    }
  }

  function mousedown () {

  }

  function mousemove () {
    if (!mousedownNode) return

    const mpos = d3.pointer(vis.node())
    // update drag line
    dragLine
      .attr('x1', mousedownNode.x)
      .attr('y1', mousedownNode.y)
      .attr('x2', mpos[0])
      .attr('y2', mpos[1])
  }

  function mouseup () {
    if (mousedownNode) {
      dragLine
        .attr('class', 'drag_line_hidden')
    }

    // clear mouse event vars
    resetMouseVars()
    // update()
  }
  // adapt size to window changes:
  window.addEventListener('resize', self.setSize, false)

  // self.zoomer = d3.zoom()
  //   .scaleExtent([0.1, 10])
  //   .x(xScale)
  //   .y(yScale)
  //   .on('zoomstart', zoomstart)
  //   .on('zoom', redraw)

  d3.select(element).select('svg').remove()

  const svg = d3.select(element)
    .attr('tabindex', 1)
    .on('keydown.brush', keydown)
    .on('keyup.brush', keyup)
    .each(function () { this.focus() })
    .append('svg:svg')
    .attr('width', self.options.svgW)
    .attr('height', self.options.svgH)
    .attr('id', 'plotting-area')

  self.options.svg = svg

  const svgGraph = svg.append('svg:g')
    .on('mousemove', mousemove)
    .on('mousedown', mousedown)
    .on('mouseup', mouseup)

  // if (self.options.allowPanningAndZooming) svgGraph.call(self.zoomer)

  /*
  let rect = svgGraph.append('svg:rect')
  .attr('width', self.options.svgW)
  .attr('height', self.options.svgH)
  .attr('fill', 'white')
  //.attr('stroke', 'grey')
  //.attr('stroke-width', 1)
  //.attr('pointer-events', 'all')
  .attr('id', 'zrect');
  */

  const brush = svgGraph.append('g')
    .datum(() => { return { selected: false, previouslySelected: false } })
    .attr('class', 'brush')

  const vis = svgGraph.append('svg:g')
  const visLinks = vis.append('svg:g')
  const visNodes = vis.append('svg:g')

  self.brusher = d3.brush()
    .extent([[xScale.range()[0], 0], [xScale.range()[1], 40]])
    .on('start', function (d) {
      const gnodes = visNodes.selectAll('g.gnode').selectAll('.outline_node')
      gnodes.each(function (d) { d.previouslySelected = ctrlKeydown && d.selected })
    })
    .on('brush', function (event) {
      const gnodes = visNodes.selectAll('g.gnode').selectAll('.outline_node')
      const extent = event.target.extent()

      gnodes.classed('selected', function (d) {
        d.selected = self.options.applyForce &&
          d.previouslySelected ^
          (extent[0][0] <= d.x && d.x < extent[1][0] && extent[0][1] <= d.y && d.y < extent[1][1])
      })
    })
    .on('end', function (event) {
      event.target.clear()
      d3.select(this).call(event.target)
    })

  brush.call(self.brusher)
    .on('mousedown.brush', null)
    .on('touchstart.brush', null)
    .on('touchmove.brush', null)
    .on('touchend.brush', null)
  brush.select('.background').style('cursor', 'auto')

  // function zoomstart () {
  //   const node = visNodes.selectAll('g.gnode').selectAll('.outline_node')
  //   node.each(function (d) {
  //     d.selected = false
  //     d.previouslySelected = false
  //   })
  //   node.classed('selected', false)
  // }

  // function redraw (event) {
  //   vis.attr('transform', 'translate(' + event.translate + ')' + ' scale(' + event.scale + ')')
  // }

  self.getBoundingBoxTransform = function () {
    // Center the view on the molecule(s) and scale it so that everything
    // fits in the window

    // no molecules, nothing to do
    if (self.graph.nodes.length === 0) { return { translate: [0, 0], scale: 1 } }

    // Get the bounding box
    const minX = d3.min(self.graph.nodes.map(function (d) { return d.x }))
    const minY = d3.min(self.graph.nodes.map(function (d) { return d.y }))

    const maxX = d3.max(self.graph.nodes.map(function (d) { return d.x }))
    const maxY = d3.max(self.graph.nodes.map(function (d) { return d.y }))

    // The width and the height of the molecule
    const molWidth = maxX - minX
    const molHeight = maxY - minY

    // how much larger the drawing area is than the width and the height
    const widthRatio = self.options.svgW / (molWidth + 1)
    const heightRatio = self.options.svgH / (molHeight + 1)

    // we need to fit it in both directions, so we scale according to
    // the direction in which we need to shrink the most
    const minRatio = Math.min(widthRatio, heightRatio) * 0.8

    // the new dimensions of the molecule
    const newMolWidth = molWidth * minRatio
    const newMolHeight = molHeight * minRatio

    // translate so that it's in the center of the window
    const xTrans = -(minX) * minRatio + (self.options.svgW - newMolWidth) / 2
    const yTrans = -(minY) * minRatio + (self.options.svgH - newMolHeight) / 2

    return { translate: [xTrans, yTrans], scale: minRatio }
  }

  self.centerView = function (duration) {
    if (arguments.length === 0) { duration = 0 }

    const bbTransform = self.getBoundingBoxTransform()

    if (bbTransform === null) { return }

    // do the actual moving
    vis.transition().attr('transform',
      'translate(' + bbTransform.translate + ')' + ' scale(' + bbTransform.scale + ')').duration(duration)

    // tell the zoomer what we did so that next we zoom, it uses the
    // transformation we entered here
    // self.zoomer.translate(bbTransform.translate)
    // self.zoomer.scale(bbTransform.scale)
  }

  self.force = d3.forceSimulation()
    .nodes(self.graph.nodes)
    .force('charge', d3.forceManyBody().strength(self.options.chargeDistance))
    .force('center', d3.forceCenter(self.options.middleCharge))
    .force(
      'link',
      d3.forceLink()
        .links(self.graph.links)
        .distance(function (d) { return self.options.linkDistanceMultiplier * d.value })
        .strength(function (d) {
          if (d.linkType in self.linkStrengths) {
            return self.linkStrengths[d.linkType]
          } else {
            return self.linkStrengths.other
          }
        })
    )
    .velocityDecay(self.options.friction)
  // .size([self.options.svgW, self.options.svgH]);

  // line displayed when dragging new nodes
  const dragLine = vis.append('line')
    .attr('class', 'drag_line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 0)
    .attr('y2', 0)

  function resetMouseVars () {
    mousedownNode = null
    mouseupNode = null
  }

  let shiftKeydown = false
  let ctrlKeydown = false

  function selectedNodes (mouseDownNode) {
    const gnodes = visNodes.selectAll('g.gnode')

    if (ctrlKeydown) {
      return gnodes.filter(function (d) { return d.selected })

      // return d3.selectAll('[struct_name=' + mouseDownNode.struct_name + ']');
    } else {
      return gnodes.filter(function (d) { return d.selected })
      // return d3.select(this);
    }
  }

  function dragstarted (event, d) {
    event.sourceEvent.stopPropagation()

    if (!d.selected && !ctrlKeydown) {
      // if this node isn't selected, then we have to unselect every other node
      const node = visNodes.selectAll('g.gnode').selectAll('.outline_node')
      node.classed('selected', function (p) { p.selected = self.options.applyForce && (p.previouslySelected = false) })
    }

    d3.select(this).select('.outline_node').classed('selected', function (p) {
      d.previouslySelected = d.selected
      d.selected = self.options.applyForce
      return true
    })

    const toDrag = selectedNodes(d)
    toDrag.each(function (d1) {
      d1.fixed |= 2
    })

    event.sourceEvent.stopPropagation()
    d3.select(self).classed('dragging', true)
  }

  function dragged (event, d) {
    const toDrag = selectedNodes(d)

    toDrag.each(function (d1) {
      d1.x += event.dx
      d1.y += event.dy

      d1.px += event.dx
      d1.py += event.dy
    })

    self.resumeForce()
    event.sourceEvent.preventDefault()
  }

  self.resumeForce = function () {
    if (self.animation) { self.force.resume() }
  }

  function dragended (event, d) {
    const toDrag = selectedNodes(d)

    toDrag.each(function (d1) {
      d1.fixed &= ~6
    })
  }

  function collide (node) {
    const r = node.radius + 16
    const nx1 = node.x - r
    const nx2 = node.x + r
    const ny1 = node.y - r
    const ny2 = node.y + r
    return function (quad, x1, y1, x2, y2) {
      if (quad.point && (quad.point !== node)) {
        let x = node.x - quad.point.x
        let y = node.y - quad.point.y
        let l = Math.sqrt(x * x + y * y)
        const r = node.radius + quad.point.radius
        if (l < r) {
          l = (l - r) / l * 0.1
          node.x -= x *= l
          node.y -= y *= l
          quad.point.x += x
          quad.point.y += y
        }
      }
      return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1
    }
  }

  const drag = d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)

  function keydown (event) {
    if (self.deaf) return
    if (shiftKeydown) return

    switch (event.keyCode) {
      case 16:
        shiftKeydown = true
        break
      case 17:
        ctrlKeydown = true
        break
      case 67: // c
        self.centerView()
        break
    }

    if (shiftKeydown || ctrlKeydown) {
      // svgGraph.call(self.zoomer)
      //   .on('mousedown.zoom', null)
      //   .on('touchstart.zoom', null)
      //   .on('touchmove.zoom', null)
      //   .on('touchend.zoom', null)

      // svgGraph.on('zoom', null);
      vis.selectAll('g.gnode')
        .on('mousedown.drag', null)
    }

    if (ctrlKeydown) {
      brush.select('.background').style('cursor', 'crosshair')
      brush.call(self.brusher)
    }
  }

  function keyup () {
    shiftKeydown = false
    ctrlKeydown = false

    brush.call(self.brusher)
      .on('mousedown.brush', null)
      .on('touchstart.brush', null)
      .on('touchmove.brush', null)
      .on('touchend.brush', null)

    brush.select('.background').style('cursor', 'auto')
    // svgGraph.call(self.zoomer)

    vis.selectAll('g.gnode')
      .call(drag)
  }

  d3.select(element)
    .on('keydown', keydown)
    .on('keyup', keyup)
    .on('contextmenu', function (event) { event.preventDefault() })

  const linkKey = d => d.uid
  const nodeKey = d => d.uid

  const updateRnaGraph = function (r) {
    const nucleotidePositions = r.getPositions('nucleotide')
    const labelPositions = r.getPositions('label')

    const uids = r.getUids()

    r.recalculateElements()
      .elementsToJson()
      .addPseudoknots()
      .addPositions('nucleotide', nucleotidePositions)
      .addUids(uids)
      .addLabels(1, self.options.labelInterval)
      .addPositions('label', labelPositions)
      .reinforceStems()
      .reinforceLoops()
      .updateLinkUids()
  }

  const removeLink = function (d) {
    // remove a link between two nodes
    const index = self.graph.links.indexOf(d)

    if (index > -1) {
      // remove a link
      // graph.links.splice(index, 1);

      // there should be two cases
      // 1. The link is within a single molecule

      if (d.source.rna === d.target.rna) {
        const r = d.source.rna

        r.addPseudoknots()
        r.pairtable[d.source.num] = 0
        r.pairtable[d.target.num] = 0

        updateRnaGraph(r)
      } else {
        // 2. The link is between two different molecules
        self.extraLinks.splice(self.extraLinks.indexOf(d), 1)
      }

      self.recalculateGraph()
    }

    self.update()
  }

  const linkClick = function (d) {
    if (!shiftKeydown) {
      return
    }

    const invalidLinks = {
      backbone: true,
      fake: true,
      fake_fake: true,
      label_link: true
    }

    if (d.linkType in invalidLinks) { return }

    removeLink(d)
  }

  self.addLink = function (newLink) {
    // this means we have a new json, which means we have
    // to recalculate the structure and change the colors
    // appropriately
    if (newLink.source.rna === newLink.target.rna) {
      const r = newLink.source.rna

      r.pairtable[newLink.source.num] = newLink.target.num
      r.pairtable[newLink.target.num] = newLink.source.num

      updateRnaGraph(r)
    } else {
      // Add an extra link
      newLink.linkType = 'intermolecule'
      self.extraLinks.push(newLink)
    }
    self.recalculateGraph()
    self.update()
  }

  const nodeMouseclick = function (event, d) {
    if (event.defaultPrevented) return

    if (!ctrlKeydown) {
      // if the shift key isn't down, unselect everything
      const node = visNodes.selectAll('g.gnode').selectAll('.outline_node')
      node.classed('selected', function (p) { p.selected = self.options.applyForce && (p.previouslySelected = false) })
    }

    // always select this node
    d3.select(this).select('circle').classed('selected', d.selected = self.options.applyForce && !d.previouslySelected)
  }

  const nodeMouseup = function (d) {
    if (mousedownNode) {
      mouseupNode = d

      if (mouseupNode === mousedownNode) return resetMouseVars()
      const newLink = { source: mousedownNode, target: mouseupNode, linkType: 'basepair', value: 1, uid: generateUUID() }

      for (let i = 0; i < self.graph.links.length; i++) {
        if ((self.graph.links[i].source === mousedownNode) ||
          (self.graph.links[i].target === mousedownNode) ||
            (self.graph.links[i].source === mouseupNode) ||
              (self.graph.links[i].target === mouseupNode)) {
          if (self.graph.links[i].linkType === 'basepair' || self.graph.links[i].linkType === 'pseudoknot') {
            return
          }
        }

        if (((self.graph.links[i].source === mouseupNode) &&
           (self.graph.links[i].target === mousedownNode)) ||
             ((self.graph.links[i].source === mousedownNode) &&
              (self.graph.links[i].target === mouseupNode))) {
          if (self.graph.links[i].linkType === 'backbone') {
            return
          }
        }
      }

      if (mouseupNode.nodeType === 'middle' || mousedownNode.nodeType === 'middle' || mouseupNode.nodeType === 'label' || mousedownNode.nodeType === 'label') { return }

      self.addLink(newLink)
    }
  }

  const nodeMousedown = function (d) {
    if (!d.selected && !ctrlKeydown) {
      // if this node isn't selected, then we have to unselect every other node
      const node = visNodes.selectAll('g.gnode').selectAll('.outline_node')
      node.classed('selected', function (p) { p.selected = p.previouslySelected = false })
    }

    d3.select(this).classed('selected', function (p) { d.previouslySelected = d.selected; d.selected = self.options.applyForce && true })

    if (!shiftKeydown) {
      return
    }

    mousedownNode = d

    dragLine
      .attr('class', 'drag_line')
      .attr('x1', mousedownNode.x)
      .attr('y1', mousedownNode.y)
      .attr('x2', mousedownNode.x)
      .attr('y2', mousedownNode.y)

    // gnodes.attr('pointer-events',  'none');
  }

  self.startAnimation = function () {
    self.animation = true
    vis.selectAll('g.gnode')
      .call(drag)
    self.force.start()
  }

  self.stopAnimation = function () {
    self.animation = false
    vis.selectAll('g.gnode')
      .on('mousedown.drag', null)
    self.force.stop()
  }

  self.setFriction = function (value) {
    self.force.friction(value)
    self.resumeForce()
  }

  self.setCharge = function (value) {
    self.force.charge(value)
    self.resumeForce()
  }

  self.setGravity = function (value) {
    self.force.gravity(value)
    self.resumeForce()
  }

  self.setPseudoknotStrength = function (value) {
    self.linkStrengths.pseudoknot = value
    self.update()
  }

  self.displayBackground = function (value) {
    self.displayParameters.displayBackground = value
    self.updateStyle()
  }

  self.displayNumbering = function (value) {
    self.displayParameters.displayNumbering = value
    self.updateStyle()
  }

  self.displayNodeOutline = function (value) {
    self.displayParameters.displayNodeOutline = value
    self.updateStyle()
  }

  self.displayNodeLabel = function (value) {
    self.displayParameters.displayNodeLabel = value
    self.updateStyle()
  }

  self.displayLinks = function (value) {
    self.displayParameters.displayLinks = value
    self.updateStyle()
  }

  self.displayPseudoknotLinks = function (value) {
    self.displayParameters.displayPseudoknotLinks = value
    self.updateStyle()
  }

  self.displayProteinLinks = function (value) {
    self.displayParameters.displayProteinLinks = value
    self.updateStyle()
  }

  self.updateStyle = function () {
    // Background
    // rect.classed('transparent', !self.displayParameters.displayBackground);
    // Numbering
    visNodes.selectAll('[node_type=label]').classed('transparent', !self.displayParameters.displayNumbering)
    visNodes.selectAll('[label_type=label]').classed('transparent', !self.displayParameters.displayNumbering)
    visLinks.selectAll('[linkType=label_link]').classed('transparent', !self.displayParameters.displayNumbering)
    // Node Outline
    svg.selectAll('circle').classed('hidden_outline', !self.displayParameters.displayNodeOutline)
    // Node Labels
    visNodes.selectAll('[label_type=nucleotide]').classed('transparent', !self.displayParameters.displayNodeLabel)
    // Links
    svg.selectAll('[link_type=real],[link_type=basepair],[link_type=backbone],[link_type=pseudoknot],[link_type=protein_chain],[link_type=chain_chain],[link_type=external]').classed('transparent', !self.displayParameters.displayLinks)
    // Pseudoknot Links
    svg.selectAll('[link_type=pseudoknot]').classed('transparent', !self.displayParameters.displayPseudoknotLinks)
    // Protein Links
    svg.selectAll('[link_type=protein_chain]').classed('transparent', !self.displayParameters.displayProteinLinks)
    // Fake Links
    visLinks.selectAll('[link_type=fake]').classed('transparent', !self.options.displayAllLinks)
    visLinks.selectAll('[link_type=fake_fake]').classed('transparent', !self.options.displayAllLinks)
  }

  self.createNewLinks = function (linksEnter) {
    const linkLines = linksEnter.append('svg:line')

    linkLines.append('svg:title')
      .text(linkKey)

    linkLines
      .classed('link', true)
      .attr('x1', function (d) { return d.source.x })
      .attr('y1', function (d) { return d.source.y })
      .attr('x2', function (d) { return d.target.x })
      .attr('y2', function (d) { return d.target.y })
      .attr('link_type', function (d) { return d.linkType })
      .attr('class', function (d) { return d3.select(this).attr('class') + ' ' + d.linkType })
      .attr('pointer-events', function (d) { if (d.linkType === 'fake') return 'none'; else return 'all' })

    return linkLines
  }

  self.createNewNodes = function (gnodesEnter) {
    gnodesEnter = gnodesEnter.append('g')
      .classed('noselect', true)
      .classed('gnode', true)
      .attr('struct_name', function (d) { return d.structName })
      .attr('transform', function (d) {
        if (typeof d.x !== 'undefined' && typeof d.y !== 'undefined') { return 'translate(' + [d.x, d.y] + ')' } else { return '' }
      })
      .each(function (d) { d.selected = d.previouslySelected = false })

    gnodesEnter
      .call(drag)
      .on('mousedown', nodeMousedown)
      .on('mousedrag', function (d) {})
      .on('mouseup', nodeMouseup)
      .attr('num', function (d) { return 'n' + d.num })
      .attr('rnum', function (d) {
        return 'n' + (d.rna.rnaLength - d.num + 1)
      })
      .on('click', nodeMouseclick)
      .transition()
      .duration(750)
      .ease(d3.easeElastic)

    // create nodes behind the circles which will serve to highlight them
    const labelAndProteinNodes = gnodesEnter.filter(function (d) {
      return d.nodeType === 'label' || d.nodeType === 'protein'
    })

    const nucleotideNodes = gnodesEnter.filter(function (d) {
      return d.nodeType === 'nucleotide'
    })

    labelAndProteinNodes.append('svg:circle')
      .attr('class', 'outline_node')
      .attr('r', function (d) { return d.radius + 1 })

    nucleotideNodes.append('svg:circle')
      .attr('class', 'outline_node')
      .attr('r', function (d) { return d.radius + 1 })

    labelAndProteinNodes.append('svg:circle')
      .attr('class', 'node')
      .classed('label', function (d) { return d.nodeType === 'label' })
      .attr('r', function (d) {
        if (d.nodeType === 'middle') return 0
        else {
          return d.radius
        }
      })
      .attr('node_type', function (d) { return d.nodeType })
      .attr('node_num', function (d) { return d.num })

    nucleotideNodes.append('svg:circle')
      .attr('class', 'node')
      .attr('node_type', function (d) { return d.nodeType })
      .attr('node_num', function (d) { return d.num })
      .attr('r', function (d) { return d.radius })
      .append('svg:title')
      .text(function (d) {
        if (d.nodeType === 'nucleotide') {
          return d.structName + ':' + d.num
        } else {
          return ''
        }
      })

    nucleotideNodes.append('svg:path')
      .attr('class', 'node')
      .attr('node_type', function (d) { return d.nodeType })
      .attr('node_num', function (d) { return d.num })
      .append('svg:title')
      .text(function (d) {
        if (d.nodeType === 'nucleotide') {
          return d.structName + ':' + d.num
        } else {
          return ''
        }
      })

    const labelsEnter = gnodesEnter.append('text')
      .text(function (d) { return d.name })
      .attr('text-anchor', 'middle')
      .attr('font-size', 8.0)
      .attr('font-weight', 'bold')
      .attr('y', 2.5)
      .attr('class', 'node-label')
      .attr('label_type', function (d) { return d.nodeType })

    /*
    labelsEnter.text(function(d) {
      return d.num;
    });
    */

    labelsEnter.append('svg:title')
      .text(function (d) {
        if (d.nodeType === 'nucleotide') {
          return d.structName + ':' + d.num
        } else {
          return ''
        }
      })

    return gnodesEnter
  }

  self.update = function () {
    self.force
      .nodes(self.graph.nodes)
      .force(
        'link',
        d3.forceLink()
          .links(self.graph.links)
          .distance(function (d) { return self.options.linkDistanceMultiplier * d.value })
          .strength(function (d) {
            if (d.linkType in self.linkStrengths) {
              return self.linkStrengths[d.linkType]
            } else {
              return self.linkStrengths.other
            }
          })
      )

    if (self.animation) {
      self.force.start()
    }

    const allLinks = visLinks.selectAll('line.link')
      .data(self.graph.links.filter(realLinkFilter), linkKey)

    allLinks.attr('class', '')
      .classed('link', true)
      .attr('link_type', function (d) { return d.linkType })
      .attr('class', function (d) { return d3.select(this).attr('class') + ' ' + d.linkType })

    const linksEnter = allLinks.enter()
    self.createNewLinks(linksEnter)

    allLinks.exit().remove()

    const gnodes = visNodes.selectAll('g.gnode')
      .data(self.graph.nodes, nodeKey)

    const gnodesEnter = gnodes.enter()

    self.createNewNodes(gnodesEnter)
    gnodes.exit().remove()

    const realNodes = self.graph.nodes.filter(function (d) { return d.nodeType === 'nucleotide' || d.nodeType === 'label' })

    let xlink
    if (self.displayFakeLinks) { xlink = allLinks } else { xlink = visLinks.selectAll('[link_type=real],[link_type=pseudoknot],[link_type=protein_chain],[link_type=chain_chain],[link_type=label_link],[link_type=backbone],[link_type=basepair],[link_type=intermolecule],[link_type=external]') }

    gnodes.selectAll('path')
      .each(positionAnyNode)

    xlink.on('click', linkClick)

    self.force.on('tick', function () {
      const q = d3.quadtree(realNodes)
      let i = 0
      const n = realNodes.length

      while (++i < n) q.visit(collide(realNodes[i]))

      xlink.attr('x1', function (d) { return d.source.x })
        .attr('y1', function (d) { return d.source.y })
        .attr('x2', function (d) { return d.target.x })
        .attr('y2', function (d) { return d.target.y })

      // Translate the groups
      gnodes.attr('transform', function (d) {
        return 'translate(' + [d.x, d.y] + ')'
      })

      gnodes.select('path')
        .each(positionAnyNode)
    })

    self.force.on('end', () => {
      gnodes.selectAll('[node_type=nucleotide]')
        .filter((d, i) => { if (i === 0) return true; else return false })
        .each((d, i) => {
          console.log('pos', d.num, d.x, d.y)
        })

      for (const uid in self.rnas) {
        for (let i = 1; i < self.rnas[uid].pairtable[0]; i++) {
          console.log('pt', i, self.rnas[uid].pairtable[i])
        }
      }
    })

    self.changeColorScheme(self.colorScheme)

    if (self.animation) {
      self.force.start()
    }

    self.updateStyle()
  }

  self.setSize()
}
