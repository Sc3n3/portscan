const net = require('net')
const argv = require('minimist')
const color = require('cli-color')

const args = argv(process.argv.slice(2), {
  default: {
    timeout: 600,
    port: 80,
    ip: '127.0.0.1',
    i: 500
  }
})

;(async (ips, ports, timeout, instances) => {

  let ipToScan
  let portToScan

  if (ips.toString().includes('-')) {
    const ipRange = ips.toString().split('-')
    ipToScan = require('ip-range-generator')(ipRange[0], ipRange[1] || ipRange[0]) 
  } else {
    ipToScan = ips.toString().split(',')
  }

  if (ports.toString().includes('-')) {
    const portRange = ports.toString().split('-')
    portToScan = require('lodash').range(Math.min(...portRange), Math.max(...portRange) + 1)
  } else {
    portToScan = ports.toString().split(',')  
  }

  const checker = (port, host) => new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout)

    const sock = net.createConnection(port, host, () => {
      clearTimeout(timer)
      sock.destroy()
      resolve({ host, port })
    })

    sock.on('error', () => {
      clearTimeout(timer)
      sock.destroy()
      resolve(false)
    })
  })
  
  const generate = function*(){
    let chunks = []
    for (const host of ipToScan) {
      for (const port of portToScan) {
        if(chunks.length >= instances){
          yield chunks
          chunks = []
        }
        chunks.push({ host, port })
      }    
    }
    if(chunks.length <= instances) {
      yield chunks  
    }
  }

  for (const chunk of generate()) {
    const promises = []

    for (const { host, port } of chunk) {
      promises.push(new Promise((resolve) => {
        resolve(checker(port, host))
        process.stdout.write(
          color.move.lineBegin +
          color.blue.bgWhiteBright("Checking: "+ host +":"+ port) +
          color.erase.lineRight
        )
      }))
    }

    for (const result of await Promise.all(promises)) {
      if (result) {
        process.stdout.write(
          color.move.lineBegin +
          color.erase.line +
          color.green(result.host +":"+ result.port) +
          "\n"
        )
      }
    }
  }

  process.stdout.write(color.erase.line + color.move.up(1))
  process.exit(0)

})(args.ip, args.port, args.timeout, args.i)