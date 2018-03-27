
const _ = require('lodash')
const React = require('react')
const propTypes = require('prop-types')
const { default: styled } = require('styled-components')
const path = require('path')
const os = require('os')
const Bluebird = require('bluebird')
const fs = Bluebird.promisifyAll(require('fs'))
const prettyBytes = require('pretty-bytes')
const selectionState = require('../../../../../shared/models/selection-state')
const analytics = require('../../../modules/analytics')
const middleEllipsis = require('../../../utils/middle-ellipsis')
let rendition

/**
 * @summary Recent files storage key
 * @constant
 * @private
 */
const RECENT_FILES_KEY = 'file-selector-recent-files'

/**
 * @summary Get directory contents of a path
 * @function
 * @private
 *
 * @param {String} dirname - directory path
 * @returns {Promise<Array<Object>>}
 *
 * @example
 * const files = getDirectoryContents('/home/user')
 * files.map((file) => {
 *   if (file.isHidden) {
 *     return `Hidden: ${file.fullpath}`
 *   }
 *
 *   if (file.isDirectory) {
 *     return `Directory: ${file.fullpath}`
 *   }
 *
 *   return `File: ${file.basename} in ${dirname}`
 * })
 */
const getDirectoryContents = (dirname) => {
  return fs.readdirAsync(dirname).then((contents) => {
    return Bluebird.map(contents, (basename) => {
      const fullpath = path.join(dirname, basename)
      const extensions = _.tail(basename.slice(-12).split(/\./g))
      const isHidden = basename.startsWith('.')
      return fs.lstatAsync(fullpath).then((stats) => {
        return {
          basename,
          dirname,
          fullpath,
          extensions,
          isDirectory: stats.isDirectory(),
          isHidden,
          size: stats.size
        }
      })
    })
  })
}

const tabs = [
  {
    label: 'Select image file',
    icon: 'file',
    element: undefined
  }
]

const BigTitle = styled.div`
  font-size: 20px;
  font-weight: bold;
`

class Tab extends React.PureComponent {
  render () {
    return (
      <div>
        <span className={ "glyphicon glyphicon-" + this.props.icon } />
        <h1>{ this.props.children }</h1>
      </div>
    )
  }
}

const TabsWrap = styled.div`
  border-bottom: 1px solid gray;
`

class Tabs extends React.PureComponent {
  constructor (props) {
    super(props)

    this.state = { index: this.props.index || 0 }
  }

  render () {
    return (
      <TabsWrap>
        {
          _.map(this.props.tabs, ({ label, icon }, index) => {
            return (
              <Tab
                icon={ icon }
                highlight={ this.state.index === index }
                onClick={ this.setState({ index }) }>
                { label }
              </Tab>
            )
          })
        }
      </TabsWrap>
    )
  }
}

const FileWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 80px;
  min-height: 90px;
  max-height: 128px;
  margin: 10px;
  background-color: ${props => props.highlight ? 'skyBlue' : 'none' }
  color: ${props => props.highlight ? 'white' : 'black' }
  cursor: pointer;
`

const Icon = styled.div`
  width: 64px;
  height: 64px;
  margin: 4px;
  background-color: lightGray;
  border-radius: 5px;
`

const Title = styled.div`
  color: black;
  text-align: center;
  max-height: 40px;
  overflow: hidden;
`

const Subtitle = styled.div`
  color: gray;
  text-align: center;
`

class MiddleEllipsis extends React.PureComponent {
  render () {
    console.log(this.props.children)
    return <span>{ middleEllipsis(this.props.children, this.props.limit) }</span>
  }
}

class FileLink extends React.PureComponent {
  constructor (props) {
    super(props)
  }

  render () {
    const icon = this.props.isDirectory
      ? 'glyphicon-glyphicon-folder-open'
      : 'glyphicon-glyphicon-file'

    return (
      <FileWrap
        onClick={ this.props.onClick }
        onDoubleClick={ this.props.onDoubleClick }
        highlight={ this.props.highlight }>
        <Icon className={ `glyphicon ${icon}` } />
        <rendition.Button
          plaintext={ true }
          tooltip={ this.props.basename }>
          <MiddleEllipsis limit={ 20 }>{ this.props.basename }</MiddleEllipsis>
        </rendition.Button>
        <Subtitle>{ prettyBytes(this.props.size) }</Subtitle>
      </FileWrap>
    )
  }
}

const Header = styled.header`
  display: flex;
  flex: auto;
  margin: 8px;
`

const Main = styled.main`
  display: flex;
`

const Footer = styled.footer`
  display: flex;
  justify-content: flex-end;
  margin: 8px;
`

const Left = styled.div`
`

const Right = styled.div`
  display: flex;
  flex-direction: column;
`

const MenuWrap = styled.div`
  display: flex;
  flex: auto;
  justify-content: space-between;
  margin: 8px;
`

const DisplayMode = styled.div`
`

const SearchWrap = styled.div`
  position: relative;
`

const SearchBar = styled.input`
  border: 2px solid gray;
  border-radius: 3px;

  &:focus + ${SearchIcon},
  &:active + ${SearchIcon} {
    display: none;
  }
`

const SearchIcon = styled.span`
  position: absolute;
  left: 0;
  top: 0;
`

const FileList = styled.div`
  display: flex;
  flex-wrap: wrap;
  height: 240px;
  overflow-x: hidden;
  overflow-y: auto;
  margin: 8px;
`

class FileSelector extends React.PureComponent {
  constructor (props) {
    super(props)

    rendition = require('rendition')

    this.state = {
      highlighted: null,
      path: props.path || os.homedir(),
      files: [],
      showHidden: false,
      scrollElem: null
    }

    this.findFile = this.findFile.bind(this)
    this.keypressToSearch = this.keypressToSearch.bind(this)
    this.closeModal = this.closeModal.bind(this)
    this.highlightFile = this.highlightFile.bind(this)
    this.selectFile = this.selectFile.bind(this)
  }

  render () {
    console.log('render')
    console.log(this.state)

    return (
      <rendition.Provider>
        <Header>
          <Tabs>
            <Tab>
              Select image file
            </Tab>
          </Tabs>
        </Header>
        <Main>
          <Left>
          </Left>
          <Right>
            <MenuWrap>
              <DisplayMode />
              <div>{ path.basename(this.state.path) }</div>
              <SearchWrap>
                <SearchBar
                  onChange={ this.findFile }
                />
                <SearchIcon className="glyphicon glyphicon-search" />
              </SearchWrap>
            </MenuWrap>
            <FileList>
              {
                this.state.files.map((file) => {
                  if (!this.state.showHidden && file.isHidden) {
                    return null
                  }

                  const refProp = {}
                  if (this.state.highlighted === file.fullpath) {
                    refProp.ref = (scrollElem) => {
                      this.setState({ scrollElem })
                    }
                  }

                  return (
                    <FileLink { ...file } { ...refProp }
                      highlight={ this.state.highlighted === file.fullpath }
                      onClick={ _.partial(this.highlightFile, file) }
                      onDoubleClick={ _.partial(this.selectFile, file) }
                    />
                  )
                })
              }
            </FileList>
          </Right>
        </Main>
        <Footer>
          <rendition.Button onClick={ this.closeModal }>Cancel</rendition.Button>
          <rendition.Button
            onClick={ _.partial(this.selectFile, this.state.highlighted) }
            disabled={ !this.state.highlighted }>
            Select file
          </rendition.Button>
        </Footer>
      </rendition.Provider>
    )
  }

  componentWillMount () {
    window.addEventListener('keypress', this.focusSearch)
  }

  componentWillUmount () {
    window.removeEventListener('keypress', this.focusSearch)
  }

  componentDidMount () {
    console.log('componentDidMount')

    getDirectoryContents(this.state.path).then((files) => {
      this.setState({ files })
    })
  }

  componentDidUpdate () {
    console.log('componentDidUpdate')

    if (this.state.highlighted === window.fullpath) {
    }

    console.log(this.state.scrollElem)
    if (this.state.scrollElem) {
      this.state.scrollElem.current.scrollIntoView(true)
    }
  }

  findFile (event) {
    console.log('findFile')

    const searchValue = event.target.value.toLowerCase()
    if (searchValue !== '') {
      const fileMatch = _.find(this.state.files, (file) => {
        const doesMatch = file.basename.toLowerCase().includes(searchValue)
        return (file.isHidden ? this.props.showHidden : true) && doesMatch
      })

      if (fileMatch) {
        this.setState({ highlighted: fileMatch.fullpath })
      }
    }
  }

  keypressToSearch (event) {
    console.log(event.key)

    if (event.keyCode > 31) {
      // focus
    }
  }

  closeModal () {
    this.props.close()
  }

  highlightFile (file, event) {
    console.log('highlightFile')
    console.log(file)

    this.setState({ highlighted: file.fullpath })
  }

  selectFile (file, event) {
    console.log('selectFile')
    console.log(file)

    if (file === null) {
      analytics.logDebug('File selector: closed without a file')
    } else if (file.isDirectory) {
      analytics.logDebug(`File selector: browse ${file.fullpath}`)

      getDirectoryContents(file.fullpath).then((files) => {
        this.setState({ path: file.fullpath, highlighted: null, files })
      })
    } else {
      analytics.logDebug(`File selector: select file ${file.fullpath}`)

      selectionState.selectImage({
        path: file.fullpath,
        extension: _.last(file.extensions),
        size: {
          original: file.size,
          final: {
            value: file.size,
            estimation: false
          }
        }
      })

      this.closeModal()
    }
  }
}

FileSelector.propTypes = {
  path: propTypes.string,

  close: propTypes.func
}

module.exports = FileSelector