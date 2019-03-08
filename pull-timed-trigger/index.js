const rimClient = require('rim-service-client')

async function parseData (data = {}, context) {
  if (!data.HentDataForArkiveringResponseElm) {
    throw Error('Invalid data in vigo response')
  }
  if (!data.HentDataForArkiveringResponseElm.Elevelement) {
    throw Error('Invalid data in vigo reponse')
  }

  const { Feilmelding: error, Elevelement: documents } = data.HentDataForArkiveringResponseElm
  // No documents found
  if (error.FeilId === '0' && error.Feiltype !== '') {
    throw Error('No new documentes found in vigo. Exiting...')
  // Other errors
  } else if (error.FeilId !== '0') {
    throw Error(`
      FeilId: ${error.FeilId}\n
      Feiltype: ${error.Feiltype}\n
      DetaljertBeskrivelse: ${error.DetaljertBeskrivelse}
    `)
  // Everything on it's right place
  } else {
    context.bindings.vigoQueue = []
    documents.forEach(document => {
      context.log(`Data funnet: ${document.Fornavn} ${document.Etternavn}`)
      const { Dokumentfil, ...message } = document // Removes base64 file since message queue is max 64kb
      
      // Add message to queue
      context.bindings.vigoQueue.push(message)
      
      // Add file to blob
      const { Dokumentfil: file, DokumentId: id } = document
      context.bindings.vigoBlob[id] = file
    })
    return JSON.stringify(documents, null, 2)
  }
}

module.exports = async function (context) {
  const args = rimClient.getDataToArchive({
    antallElevDokument: process.env.ANTALL_ELEV_DOKUMENT,
    fylke: process.env.VGO_FYLKE
  })

  const options = {
    url: process.env.VGO_URL,
    username: process.env.VGO_USERNAME,
    password: process.env.VGO_PASSWORD,
    data: args
  }

  try {
    const data = await rimClient(options)
    const documents = await parseData(data, context)
    context.log(documents)
  } catch (error) {
    context.log.error(error)
  }
}