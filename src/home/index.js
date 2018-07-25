import './index.css'
import { fetchSpreadsheetData, groupBy } from '../utils'
import * as d3 from 'd3'

window.addEventListener('DOMContentLoaded', init)

function init () {
  fetchSpreadsheetData()
    .then(transformData)
    .then(buildNetwork)
}

function transformData (tabletop) {
  console.log('Transforming')
  const data = tabletop.sheets('aga').all()
  const items = data.map(item => ({ id: item.compromiso, completion: item.completitud }))
  const grouped = groupBy(items, 'id', 'completion')
  const bubbles = Object.keys(grouped).reduce((group, key) => {
    group[key] = grouped[key].reduce((a, b) => a + b) / grouped[key].length
    return group
  }, {})
  const nodes = Object.keys(bubbles).reduce((n, key) => {
    n.push({ id: key, completion: bubbles[key] })
    return n
  }, [])
  return nodes
}

function buildNetwork (nodes) {
  let width, height, tooltip
  const nodeColors = d3.scaleLinear()
    .domain([0, 25, 50, 75, 100])
    .range(['#FF0000', '#FFFF00', '#FFFF00', '#7FFF00', '#00FF00'])
  const scaleRadius = d3.scaleLinear()
    .domain([0, 100])
    .range([5, 105])
  const svg = d3.select('svg')
  const simulation = d3.forceSimulation()
    .force('collision', d3.forceCollide().radius(d => d.completion + 5))
    .force('charge', d3.forceManyBody().strength(5))
    .force('x', d3.forceX())
    .force('y', d3.forceY())

  let node = svg.append('g')
    .attr('class', 'nodes')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('r', d => scaleRadius(d.completion))
    .attr('fill', d => nodeColors(d.completion))
    .on('mouseover', showDetail)
    .on('mouseout', hideDetail)

  simulation
    .nodes(nodes)
    .on('tick', ticked)

  function ticked () {
    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
  }

  resize()
  d3.select(window).on('resize', resize)
  function resize () {
    width = window.innerWidth
    height = window.innerHeight
    svg.attr('width', width).attr('height', height)
    simulation.force('center', d3.forceCenter(width / 2, height / 2))
    simulation.restart()
  }

  function showDetail (node) {
    if (!tooltip) {
      createTooltip()
    }
    d3.select(this).attr('stroke', 'black')
    const content = `
      <p>
        <strong>Compromiso: </strong>
        <span>${node.id}</span>
      </p>
      <p>
        <strong>Completado: </strong>
        <span>${node.completion.toFixed(2)}%</span>
      </p>
    `
    showTooltip(content, d3.event)
  }

  function hideDetail (node) {
    d3.select(this).attr('stroke', null)
    hideTooltip()
  }

  function createTooltip () {
    tooltip = d3.select('.graphic')
      .append('div')
      .attr('class', 'tooltip')
      .style('pointer-events', 'none')
    hideTooltip()
  }

  function showTooltip (content, event) {
    tooltip
      .style('opacity', 1)
      .html(content)

    updatePosition(event)
  }

  function hideTooltip () {
    tooltip.style('opacity', 0)
  }

  function updatePosition (event) {
    const { clientX, clientY } = event
    const ttw = parseFloat(tooltip.style('width').replace(/\D/g, ''))
    const tth = parseFloat(tooltip.style('height').replace(/\D/g, ''))
    const cursorX = clientX - (ttw / 2)
    const cursorY = (clientY - (tth / 2)) + 50

    tooltip.style('top', cursorY + 'px')
    tooltip.style('left', cursorX + 'px')
  }
}
