document.querySelectorAll('.highlight .video-container .controls .control-btn').forEach(btn =>{
    btn.onclick = () =>{
        let src = btn.getAttribute('data-src');
        document.querySelector('.highlight .video-container .video').src = src;
    }
})