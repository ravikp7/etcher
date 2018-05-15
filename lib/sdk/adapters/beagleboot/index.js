'use strict'

const EventEmitter = require('events')
const BeagleBoot = require('beagle-boot')
const _ = require('lodash')

/**
 * @summary Estimated Mass Storage device show delay
 * @type {Number}
 * @constant
 */
const DEVICE_SHOW_DELAY = 1500

/**
 * @summary BeagleBootAdapter
 * @class
 */
class BeagleBootAdapter extends EventEmitter {
  /**
   * @summary USBBootAdapter constructor
   * @class
   * @example
   * const adapter = new USBBootAdapter()
   */
  constructor () {
    super()

    /** @type {String} Adapter name */
    this.id = this.constructor.id

    /** @type {Object} Progress hash */
    this.progress = {}

    this.devices = []
    this.on('devices', (devices) => {
      this.devices = devices
    })
  }

  /**
   * @summary Scan for BeagleBone AM335x devices
   * @public
   *
   * @returns {BeagleBootAdapter}
   *
   * @example
   * adapter.scan()
   */
  scan () {
    // This runs the BeagleBoot Server
    const umsServer = BeagleBoot.usbMassStorage()

    const result = {
      device: 'beaglebone',
      displayName: 'Initializing device',
      description: 'BeagleBone',
      size: null,
      mountpoints: [],
      isReadOnly: false,
      disabled: true,
      isSystem: false,
      icon: 'loading',
      adaptor: this.id,
      progress: 0
    }

    umsServer.on('connect', (device) => {
      if (device === 'ROM') {
        const devices = []
        devices.push(result)
        this.emit('devices', devices)
      }
      if (device === 'UMS') {
        const devices = []

        // The USB Mass Storage device shows up with a delay
        setTimeout(() => {
          this.emit('devices', devices)
        }, DEVICE_SHOW_DELAY)
      }
    })

    umsServer.on('progress', (status) => {
      const devices = []
      devices.push(_.assign({ }, result, { progress: status.complete }))
      this.emit('devices', devices)
    })

    umsServer.on('error', (error) => {
      const errorState = {
        displayName: `Error! Reset board [${error}]`,
        icon: 'warning',
        progress: 0
      }
      const errorResult = _.assign({}, result, errorState)
      const devices = []
      devices.push(errorResult)
      this.emit('devices', devices)
    })

    return this
  }
}

/**
 * @summary The name of this adapter
 * @public
 * @type {String}
 * @constant
 */
BeagleBootAdapter.id = 'beagleboot'

// Exports
module.exports = BeagleBootAdapter
