import './index.css'
import { fetchSpreadsheetData, groupBy } from '../utils'
import * as d3 from 'd3'

window.addEventListener('DOMContentLoaded', init)

function init () {
  fetchSpreadsheetData()
    .then(transformData)
    .then(buildGraphics)
}

function transformData (tabletop) {
  const data = tabletop.sheets('aga').all()
  const items = data.map(item => {
    return {
      id: item.compromiso,
      completion: item.completitud,
      sector: item.sector,
      entity: item.entidad,
      startDate: item.fecha_inicio,
      endDate: item.fecha_fin_plan,
      activity: item.actividad
    }
  })
  const grouped = groupBy(items, 'id')
  const bubbles = Object.keys(grouped).reduce((group, key) => {
    const sum = grouped[key].reduce((sum, object) => {
      sum += object.completion
      return sum
    }, 0)
    const length = grouped[key].length
    const sector = Array.from(new Set(grouped[key].map(item => item.sector)))
    group[key] = {
      total: sum / length,
      sector: sector.length > 1 ? sector : sector.join('')
    }
    return group
  }, {})
  const nodes = Object.keys(bubbles).reduce((n, key) => {
    n.push({ id: key, completion: bubbles[key].total, sector: bubbles[key].sector })
    return n
  }, [])
  // const total = nodes.reduce((number, node) => {
  //   number += node.completion
  //   return number
  // }, 0)
  /* Entities */
  const groupedEntities = groupBy(items, 'entity', 'completion')
  const temp = Object.keys(groupedEntities).reduce((group, key) => {
    group[key] = groupedEntities[key].reduce((a, b) => a + b) / groupedEntities[key].length
    return group
  }, {})
  const entities = Object.keys(temp).reduce((n, key) => {
    n.push({ entity: key, completion: temp[key] })
    return n
  }, []).sort((a, b) => a.completion - b.completion)
  /* Activities */
  const tasks = items.map(task => {
    return {
      endDate: task.endDate,
      startDate: task.startDate,
      task: task.activity,
      type: task.id,
      completion: task.completion
    }
  })
  return { nodes, entities, tasks }
}

function buildGraphics ({nodes, entities, tasks}) {
  buildEntitiesTemplate(entities)
  buildNetwork(nodes)
  buildGantt(tasks)
}

function buildEntitiesTemplate (entities) {
  const container = document.getElementById('entities')
  const template = entities.reduce((str, entity) => {
    const completion = entity.completion.toFixed(1)
    str += `<div class='entity' data-completion='${completion}'><div class='entity__name'>${entity.entity}</div><div class='entity__completion'>${completion}%</div><div class='entity__bar' style='width: ${completion}%'></div></div>`
    return str
  }, '')
  container.innerHTML = template
}

function buildGantt (tasks) {
  let taskFiltered, rectangles, barHeight, optionSelected, svg
  const width = {
    inner: 0,
    outer: 0
  }
  const height = {
    inner: 0,
    outer: 0
  }
  const margin = { left: 30, top: 30, right: 30, bottom: 30 }

  svg = d3.select('#gantt').select('svg')
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`)

  setSizes()
  renderTemplate()
  d3.select(window).on('resize', setSizes)
  filterTask(optionSelected)
  const formatDate = d3.timeParse('%Y-%m-%d')
  let scaleDate = d3.scaleTime().range([0, width.inner])
  const axisDate = d3.axisBottom().tickFormat(d3.timeFormat('%b %Y'))
  updateAxis(true)
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0, ${height.inner})`).call(axisDate)
  updateGantt()

  function renderTemplate () {
    const categories = Array.from(new Set(tasks.map(t => t.type)))
    const select = document.getElementById('tasks')
    const options = categories.reduce((str, category, index) => {
      str += `<option value="${index}">${category}</option>`
      return str
    }, '')
    optionSelected = categories[0]
    select.innerHTML = options
    select.querySelector('option').selected = true
    select.addEventListener('change', e => {
      optionSelected = categories[e.target.value]
      filterTask(optionSelected)
      updateAxis(false)
      updateGantt()
    })
  }

  function setSizes () {
    const container = document.querySelector('#gantt')
    const svg = document.querySelector('#gantt svg')
    width.outer = Math.floor(container.offsetWidth)
    height.outer = window.innerHeight * 0.5
    width.inner = width.outer - margin.left - margin.right
    height.inner = height.outer - margin.top - margin.bottom
    svg.style.width = width.outer
    svg.style.height = height.outer
  }

  function filterTask (taskType) {
    taskFiltered = tasks.filter(task => task.type === taskType).sort((a, b) => a.startDate - b.startDate)
    barHeight = height.inner / taskFiltered.length
  }

  function updateAxis (init) {
    scaleDate = scaleDate
      .domain([
        d3.min(taskFiltered, t => formatDate(t.startDate)),
        d3.max(taskFiltered, t => formatDate(t.endDate))
      ])
    axisDate.scale(scaleDate)
    if (init) return
    const t = d3.transition().duration(500)
    svg.select('.axis').transition(t).call(axisDate)
  }

  function updateGantt () {
    const t = d3.transition().duration(500)
    rectangles = svg.selectAll('rect').data(taskFiltered)

    rectangles.exit().remove()

    const incomingRects = rectangles
      .enter()
      .append('rect')
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', '#698f3f')
      .attr('opacity', 0.5)

    rectangles = incomingRects.merge(rectangles)

    rectangles
      .attr('height', barHeight - 5)
      .attr('x', d => scaleDate(formatDate(d.startDate)))
      .attr('y', (d, i) => i * barHeight)
      .attr('width', 0)
      .transition(t)
      .attr('width', d => scaleDate(formatDate(d.endDate)) - scaleDate(formatDate(d.startDate)))

    rectangles.on('mouseover', showDetail).on('mouseout', hideDetail)
  }

  function showDetail (rect) {
    const detailTemplate = `
      <p>
        <strong>Actividad: </strong>
        <span>${rect.task}</span>
      </p>
      <p>
        <strong>Inicio: </strong>
        <span>${rect.startDate}</span>
      </p>
      <p>
        <strong>Finalización: </strong>
        <span>${rect.endDate}</span>
      </p>
      <p>
        <strong>Completado: </strong>
        <span>${rect.completion.toFixed(1)}%</span>
      </p>
    `
    const output = document.querySelector('.gantt-tag')
    output.innerHTML = detailTemplate
    output.style.display = 'block'
  }

  function hideDetail (rect) {
    const output = document.querySelector('.gantt-tag')
    output.style.display = 'none'
  }
}

function buildNetwork (nodes) {
  let width, height, tooltip, optionSelected
  const radius = {
    min: 20,
    max: 100
  }
  const margin = radius.max
  const nodeColors = d3.scaleLinear()
    .domain([0, 25, 50, 75, 100])
    .range(['#FF0000', '#FFFF00', '#FFFF00', '#7FFF00', '#00FF00'])
  const scaleRadius = d3.scaleLinear()
    .domain([0, 100])
    .range([radius.min, radius.max])
  const svg = d3.select('.bubble-chart').select('svg')
  const svgGroup = svg.append('g')
    .attr('transform', `translate(${margin}, ${margin / 2})`)
  let node = svgGroup.append('g').attr('class', 'nodes')
  const simulation = d3.forceSimulation()
    .force('charge', d3.forceManyBody())
    .force('collision', d3.forceCollide().radius(d => scaleRadius(d.completion)))
    .on('tick', ticked)

  renderTemplate()
  resize()
  window.addEventListener('resize', resize)
  updateBubbles()

  function updateBubbles (filter) {
    let data
    if (!filter || filter === 'Todos') {
      data = nodes
    } else {
      data = nodes.filter(node => node.sector === filter)
    }
    node = svgGroup.selectAll('circle').data(data)

    node.exit().transition().attr('r', 0).remove()

    const incomingNodes = node
      .enter()
      .append('circle')
      .on('mouseover', showDetail)
      .on('mouseout', hideDetail)

    node = incomingNodes.merge(node)
    node
      .attr('r', 0)
      .transition()
      .attr('r', d => scaleRadius(d.completion))
      .attr('fill', d => nodeColors(d.completion))
    simulation.nodes(nodes)
    simulation.restart()
  }

  function ticked () {
    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
  }

  function resize () {
    width = window.innerWidth - (2 * margin)
    height = window.innerHeight - (2 * margin)
    svg.attr('width', width + (2 * margin)).attr('height', height + (2 * margin))
    simulation
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2))
      .force('y', d3.forceY(width / 2))
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
      <p>
        <strong>Sector: </strong>
        <span>${node.sector}</span>
      </p>
    `
    showTooltip(content, d3.event)
  }

  function hideDetail (node) {
    d3.select(this).attr('stroke', null)
    hideTooltip()
  }

  function createTooltip () {
    tooltip = d3.select('.bubble-chart')
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
    const cursorX = event.target.cx.animVal.value
    const cursorY = event.target.cy.animVal.value + (event.target.r.animVal.value * 1.5)

    tooltip.style('top', cursorY + 'px')
    tooltip.style('left', cursorX + 'px')
  }

  function renderTemplate () {
    const categories = Array.from(new Set(nodes.map(node => node.sector)))
    categories.unshift('Todos')
    const select = document.getElementById('bubble-select')
    const options = categories.reduce((str, category, index) => {
      str += `<option value="${index}">${category}</option>`
      return str
    }, '')
    optionSelected = categories[0]
    select.innerHTML = options
    select.querySelector('option').selected = true
    select.addEventListener('change', e => {
      optionSelected = categories[e.target.value]
      updateBubbles(optionSelected)
    })
  }
}
