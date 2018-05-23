'use strict'

const EventEmitter = require('events')
const BeagleBoot = require('beagle-boot')
const _ = require('lodash')

// This runs the BeagleBoot Server
const umsServer = BeagleBoot.usbMassStorage()

/**
 * @summary Estimated Mass Storage device show delay
 * @type {Number}
 * @constant
 */
const DEVICE_SHOW_DELAY = 1500

/**
 * @summary Boot process half progress
 * @type {Number}
 * @constant
 */
const HALF_PROGRESS = 50

/**
 * @summary Boot process full progress
 * @type {Number}
 * @constant
 */
const FULL_PROGRESS = 100

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
    // Remove Listeners if this function is called again
    umsServer.removeAllListeners()

    // Device object
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
        result.progress = 0
        this.pushDevice(result)
      }

      // Remove BeagleBoot Adapter on completion
      if (device === 'UMS') {
        // The USB Mass Storage device shows up with a delay
        setTimeout(() => {
          this.pushDevice()
        }, DEVICE_SHOW_DELAY)
      }
    })

    // Update Progress
    umsServer.on('progress', (status) => {
      result.progress = status.complete
      this.pushDevice(result)
    })

    // Handle Error
    umsServer.on('error', (error) => {
      const errorState = {
        displayName: `Error! Reset board [${error}]`,
        icon: 'warning'
      }
      this.pushDevice(_.assign({}, result, errorState))
    })

    // Empty Device list on disconnect
    umsServer.on('disconnect', (device) => {
      if (device === 'ROM' && result.progress !== HALF_PROGRESS) {
        this.pushDevice()
      }
      if (device === 'SPL' && result.progress !== FULL_PROGRESS) {
        this.pushDevice()
      }
    })

    return this
  }

  /**
   * @summary Push Devices
   * @function
   * @private
   *
   * @param {Object} device - optional device
   *
   * @example
   * adapter.pushDevice(device)
   */
  pushDevice (device) {
    const devices = []
    if (device) devices.push(device)
    this.emit('devices', devices)
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
