import Tabletop from 'tabletop'

function fetchSpreadsheetData () {
  return new Promise((resolve, reject) => {
    Tabletop.init({
      key: 'https://docs.google.com/spreadsheets/d/1l7gFSe1nEO_t9n5V9ybbCWGuDUgpVroWg_aYTbA0rL8/edit?usp=sharing',
      callback: (data, tabletop) => {
        resolve(tabletop)
      },
      postProcess: element => {
        element['completitud'] = element['completitud'] ? parseInt(element['completitud'].replace(/\W/, ''), 10) : 0
      }
    })
  })
}

function groupBy (array, key, alt) {
  return array.reduce((group, item) => {
    group[item[key]] = group[item[key]] || []
    alt ? group[item[key]].push(item[alt]) : group[item[key]].push(item)
    return group
  }, {})
}

export { fetchSpreadsheetData, groupBy }
