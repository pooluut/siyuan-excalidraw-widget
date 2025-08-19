【deprecated】 move to https://gitee.com/pooluut/siyuan-excalidraw-widget

# project description

This is a customized excalidraw widget for Siyuan Note. With customizing changes:

* delete strokeslopness
* remove left main menu
* remove bottom menu
* disable mobile mode
* add copy siyuan block/document link to excalidraw(ctrl+shift+c to copy block/doc, ctrl+v/ctrl+shift+v to paste on excalidraw)

# Deployment

```
cd {Siyuan}/data/widgets/
git clone https://github.com/pooluut/siyuan-excalidraw-widget.git -b dev siyuan-excalidraw-widget
```

# Developer


code Root:


examples\siyuan


```
yarn install
yarn build:packages
yarn depo
```
