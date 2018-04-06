
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

const getFileMetadata = (dirname, basename) => {
  const fullpath = path.join(dirname, basename)
  const extensions = _.tail(basename.slice(-12).split(/\./g))

  // TODO(Shou): this is not true for Windows, figure out Windows hidden files
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
}

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
      return getFileMetadata(dirname, basename)
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

const Icon = styled.i`
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
      ? 'fa fa-folder'
      : 'fa fa-file'

    return (
      <FileWrap
        onClick={ this.props.onClick }
        onDoubleClick={ this.props.onDoubleClick }
        highlight={ this.props.highlight }>
        <Icon className={ icon } />
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
  overflow: hidden;
`

const SearchBar = styled.input`
  border: 1.5px solid gray;
  border-radius: 3px;
  padding: 2px;
  width: 100%;

  &:focus + .glyphicon,
  &:active + .glyphicon {
    left: -12px;
  }
`

const SearchIcon = styled.span`
  position: absolute;
  left: 10px;
  top: 6px;
  transition: left ease-in-out 0.3s;
`

class ParentDirs extends React.PureComponent {
  constructor (props) {
    super(props)

    this.onChange = this.onChange.bind(this)
  }

  render () {
    console.log('ParentDirs: render')
    // There is no path to display
    if (!this.props.file) {
      return null
    }

    const pathDirs = this.getPathDirs()
    console.log(pathDirs)

    return (
      <rendition.Select
        onChange={ this.onChange }>
        {
          _.map(pathDirs, (dir, index) => {
            return <option value={ dir } selected={ pathDirs.length === index + 1 }>{ dir }</option>
          })
        }
      </rendition.Select>
    )
  }

  onChange ({ target }) {
    console.log('ParentDirs: onChange')
    const { selectedIndex } = target
    const fullpath = path.join(...this.getPathDirs().slice(0, selectedIndex + 1))

    this.props.selectFile({
      fullpath,
      dirname: path.dirname(fullpath),
      basename: path.basename(fullpath),
      isDirectory: true,
      extensions: [],
      isHidden: null,
      size: null
    })
  }

  getPathDirs () {
    return [ '/' ].concat(_.tail(this.props.file.dirname.split(path.sep)))
  }
}

const FileListWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  height: 230px;
  overflow-x: hidden;
  overflow-y: auto;
  margin: 8px;
`

class FileList extends React.PureComponent {
  constructor (props) {
    super(props)

    this.state = {
      rules: [
        {
          name: 'isHidden',
          operator: 'is false',
          type: 'Boolean',
          value: ''
        }
      ],
      views: [
        {
          key: 'global',
          scopeLabel: 'everyone',
          title: 'Global',
          data: []
        }
      ],
      schema: {
        basename: {
          type: 'Short Text'
        },
        isHidden: {
          type: 'Boolean'
        },
        isDirectory: {
          type: 'Boolean'
        }
      },
      sieve: rendition.SchemaSieve()
    }
  }

  render () {
    console.log(this.state)
    const items = this.state.sieve.filter(this.props.files, this.state.rules)

    return (
      <div>
        <rendition.Filters
          rules={ this.state.rules }
          views={ this.state.views }
          schema={ this.state.schema }
          setViews={ views => this.setViews(views) }
          setRules={ rules => this.setRules(rules) }
        />

        <FileListWrap>
          {
            items.map((item, index) => {
              return (
                <FileLink { ...item }
                  /* Select file */
                  onDoubleClick={ _.partial(this.props.selectFile, item) }
                />
              )
            })
          }
        </FileListWrap>
      </div>
    )
  }

  setViews (views) {
    this.setState({ views })
  }

  setRules (rules) {
    this.setState({ rules })
  }
}


class Path extends React.PureComponent {
  constructor (props) {
    super(props)

    this.onClick = this.onClick.bind(this)
  }

  render () {
    console.log('Path: render')
    console.log(this.props.path)
    const parsedPath = path.parse(this.props.path)
    console.log(path)
    const pathDirs = parsedPath.split(path.sep)

    return (
      <div> {
        pathDirs.map((directory, index) => {
          return (
            <rendition.Button onClick={ this.onClick(index) }>{ directory }</rendition.Button>
          )
        })
      } </div>
    )
  }

  onClick (index) {
    return () => {
      const pathDirs = path.parse(this.props.path).split(path.sep)
      const fullpath = pathDirs.slice(0, index + 1)
      this.props.setPath(fullpath)
    }
  }
}

class FileSelector extends React.PureComponent {
  constructor (props) {
    super(props)

    rendition = require('rendition')

    this.state = {
      path: props.path || os.homedir(),
      files: []
    }

    this.keybindings = this.keybindings.bind(this)
    this.closeModal = this.closeModal.bind(this)
    this.selectFile = this.selectFile.bind(this)
  }

  render () {
    console.log('render')

    const currentDir = _.head(this.state.files)

    return (
      <rendition.Provider>
        <Main>
          <Left>
          </Left>
          <Right>
            <MenuWrap>
            </MenuWrap>
            <FileList files={ this.state.files } selectFile={ this.selectFile } />
          </Right>
        </Main>
        <Footer>
          <rendition.Button onClick={ this.closeModal }>Cancel</rendition.Button>
          <rendition.Button
            onClick={ _.partial(this.selectFile, this.state.highlightedFile) }
            disabled={ !this.state.highlightedFile }>
            Select file
          </rendition.Button>
        </Footer>
      </rendition.Provider>
    )
  }

  componentWillMount () {
    window.addEventListener('keypress', this.keybindings)
  }

  componentWillUmount () {
    window.removeEventListener('keypress', this.keybindings)
  }

  componentDidMount () {
    console.log('componentDidMount')

    getDirectoryContents(this.state.path).then((files) => {
      this.setState({ files })
    })
  }

  componentDidUpdate () {
    console.log('componentDidUpdate')
  }

  keybindings (event) {
    console.log(event.key)
  }

  closeModal () {
    this.props.close()
  }

  selectFile (file, event) {
    console.log('selectFile')
    console.log(file)

    if (file === null) {
      analytics.logDebug('File selector: closed without a file')
    } else if (file.isDirectory) {
      analytics.logDebug(`File selector: browse ${file.fullpath}`)

      getDirectoryContents(file.fullpath).then((files) => {
        this.setState({ path: file.fullpath, files })
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
